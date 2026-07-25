use serde::Serialize;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};

#[derive(Default)]
struct JobRegistry(Mutex<HashMap<String, JobProcess>>);

struct JobProcess {
    pid: u32,
    canceled: bool,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct SearchResult {
    id: String,
    title: String,
    channel: String,
    duration: String,
    duration_seconds: Option<f64>,
    views: String,
    view_count: Option<u64>,
    url: String,
    thumbnail: Option<String>,
}

// Search and URL resolution are delegated to the canonical lyt sidecar. The
// desktop shell deliberately does not construct yt-dlp arguments itself.
#[tauri::command]
fn search(query: String) -> Result<Vec<SearchResult>, String> {
    let document = run_lyt(["search", "--json", "--limit", "20", "--", &query])?;
    Ok(result_values(&document)
        .iter()
        .map(entry_to_result)
        .collect())
}

#[tauri::command]
fn resolve(url: String) -> Result<Vec<SearchResult>, String> {
    let document = run_lyt(["inspect", "--json", "--", &url])?;
    Ok(result_values(&document)
        .iter()
        .map(entry_to_result)
        .collect())
}

// Start the canonical lyt engine with its versioned JSONL event stream.
// The frontend supplies the id so it can register its listener before this
// command starts, avoiding missed early events.
#[tauri::command]
fn start_download(
    app: AppHandle,
    registry: State<'_, JobRegistry>,
    job_id: String,
    url: String,
    kind: String,
    quality: String,
    folder: String,
) -> Result<String, String> {
    if job_id.trim().is_empty() {
        return Err("jobId is required".into());
    }

    let args = download_args(&job_id, &url, &kind, &quality, &folder);
    let mut sidecar = Command::new(lyt_sidecar());
    sidecar
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        sidecar.process_group(0);
    }
    let mut child = sidecar
        .spawn()
        .map_err(|error| sidecar_error(error.to_string()))?;

    let pid = child.id();
    registry
        .0
        .lock()
        .map_err(|_| "Job registry is unavailable".to_string())?
        .insert(
            job_id.clone(),
            JobProcess {
                pid,
                canceled: false,
            },
        );

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    let channel = format!("progress:{job_id}");
    let app_for_worker = app.clone();
    let id_for_worker = job_id.clone();

    std::thread::spawn(move || {
        let mut saw_terminal = false;
        if let Some(stderr) = stderr {
            std::thread::spawn(move || {
                let mut reader = BufReader::new(stderr);
                let mut sink = String::new();
                let _ = reader.read_to_string(&mut sink);
            });
        }

        if let Some(stdout) = stdout {
            for line in BufReader::new(stdout).lines().map_while(Result::ok) {
                if let Ok(event) = serde_json::from_str::<Value>(&line) {
                    if event.get("schema").and_then(Value::as_str) == Some("lyt.job-event.v1") {
                        saw_terminal |= matches!(
                            event.get("type").and_then(Value::as_str),
                            Some("completed" | "failed" | "canceled")
                        );
                        let _ = app_for_worker.emit(&channel, event);
                    }
                }
            }
        }

        let status = child.wait();
        let state = app_for_worker.state::<JobRegistry>();
        let canceled = state
            .0
            .lock()
            .ok()
            .and_then(|mut jobs| jobs.remove(&id_for_worker))
            .map(|job| job.canceled)
            .unwrap_or(false);
        if !matches!(status, Ok(exit) if exit.success()) && !saw_terminal && !canceled {
            let _ = app_for_worker.emit(
                &channel,
                json!({
                    "jobId": id_for_worker,
                    "type": "failed",
                    "data": { "message": "lyt sidecar exited before completing the job" }
                }),
            );
        }
    });

    Ok(job_id)
}

#[tauri::command]
fn cancel_download(
    app: AppHandle,
    registry: State<'_, JobRegistry>,
    job_id: String,
) -> Result<(), String> {
    let pid = {
        let mut jobs = registry
            .0
            .lock()
            .map_err(|_| "Job registry is unavailable".to_string())?;
        let job = jobs
            .get_mut(&job_id)
            .ok_or_else(|| "Download is no longer running".to_string())?;
        job.canceled = true;
        job.pid
    };

    if let Err(error) = terminate_process(pid) {
        if let Ok(mut jobs) = registry.0.lock() {
            if let Some(job) = jobs.get_mut(&job_id) {
                job.canceled = false;
            }
        }
        return Err(error);
    }
    let _ = app.emit(
        &format!("progress:{job_id}"),
        json!({
            "jobId": job_id,
            "type": "canceled",
            "data": {}
        }),
    );
    Ok(())
}

fn run_lyt<const N: usize>(args: [&str; N]) -> Result<Value, String> {
    let output = Command::new(lyt_sidecar())
        .args(args)
        .output()
        .map_err(|error| sidecar_error(error.to_string()))?;

    if !output.status.success() {
        let detail = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let json_message = serde_json::from_slice::<Value>(&output.stdout)
            .ok()
            .and_then(|value| {
                value
                    .get("error")
                    .and_then(|error| error.get("message"))
                    .and_then(Value::as_str)
                    .map(str::to_string)
            });
        return Err(if detail.is_empty() {
            json_message.unwrap_or_else(|| "lyt sidecar failed without an error message".into())
        } else {
            detail
        });
    }

    serde_json::from_slice(&output.stdout)
        .map_err(|error| format!("Could not parse lyt sidecar output: {error}"))
}

fn lyt_sidecar() -> String {
    std::env::var("LYT_SIDECAR").unwrap_or_else(|_| {
        if cfg!(windows) {
            "lyt.cmd".into()
        } else {
            "lyt".into()
        }
    })
}

fn sidecar_error(detail: String) -> String {
    format!(
        "Could not run the lyt sidecar: {detail}. Install lyt or set LYT_SIDECAR to its executable."
    )
}

fn result_values(document: &Value) -> Vec<Value> {
    if let Some(results) = document.get("results").and_then(Value::as_array) {
        return results.clone();
    }
    if let Some(media) = document.get("media") {
        return vec![media.clone()];
    }
    if let Some(result) = document.get("result") {
        return vec![result.clone()];
    }
    if document.is_object() {
        return vec![document.clone()];
    }
    Vec::new()
}

fn entry_to_result(entry: &Value) -> SearchResult {
    let metadata = entry.get("metadata").unwrap_or(entry);
    let id = text(metadata, &["id", "videoId"]);
    let url = text(metadata, &["url", "webpageUrl", "webpage_url"]);
    let duration_seconds = number(metadata, &["durationSeconds", "duration"]);
    let view_count = number(metadata, &["viewCount", "view_count"]).map(|n| n as u64);

    SearchResult {
        id: id.clone(),
        title: text(metadata, &["title"]),
        channel: text(metadata, &["channel", "uploader"]),
        duration: format_duration(duration_seconds),
        duration_seconds,
        views: format_views(view_count),
        view_count,
        url: if url.is_empty() && !id.is_empty() {
            format!("https://www.youtube.com/watch?v={id}")
        } else {
            url
        },
        thumbnail: optional_text(metadata, &["thumbnail"]),
    }
}

fn text(value: &Value, keys: &[&str]) -> String {
    optional_text(value, keys).unwrap_or_default()
}

fn optional_text(value: &Value, keys: &[&str]) -> Option<String> {
    keys.iter()
        .find_map(|key| value.get(key).and_then(Value::as_str))
        .map(str::to_string)
}

fn number(value: &Value, keys: &[&str]) -> Option<f64> {
    keys.iter()
        .find_map(|key| value.get(key).and_then(Value::as_f64))
}

fn download_args(job_id: &str, url: &str, kind: &str, quality: &str, folder: &str) -> Vec<String> {
    let folder = expand_folder(folder);
    let mut args = vec![
        "--events-jsonl".into(),
        "--job-id".into(),
        job_id.into(),
        "--output-dir".into(),
        folder,
    ];

    if kind == "video" {
        args.push("--video".into());
        if quality != "best" {
            args.push("--quality".into());
            args.push(quality.into());
        }
    } else {
        args.push("--audio".into());
        if let Some(bitrate) = quality.strip_prefix("mp3-") {
            args.push("--mp3".into());
            args.push("--quality".into());
            args.push(format!("{bitrate}K"));
        }
    }

    args.push("--".into());
    args.push(url.into());
    args
}

fn expand_folder(folder: &str) -> String {
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .ok();
    expand_folder_with_home(folder, home.as_deref())
}

fn expand_folder_with_home(folder: &str, home: Option<&str>) -> String {
    let Some(home) = home else {
        return folder.to_string();
    };
    if folder == "~" {
        return home.to_string();
    }
    let suffix = folder
        .strip_prefix("~/")
        .or_else(|| folder.strip_prefix("~\\"));
    match suffix {
        Some(suffix) => PathBuf::from(home)
            .join(suffix)
            .to_string_lossy()
            .into_owned(),
        None => folder.to_string(),
    }
}

fn format_duration(seconds: Option<f64>) -> String {
    let Some(total) = seconds.map(|value| value as u64) else {
        return String::new();
    };
    let (hours, minutes, seconds) = (total / 3600, (total % 3600) / 60, total % 60);
    if hours > 0 {
        format!("{hours}:{minutes:02}:{seconds:02}")
    } else {
        format!("{minutes}:{seconds:02}")
    }
}

fn format_views(count: Option<u64>) -> String {
    let Some(count) = count else {
        return String::new();
    };
    if count >= 1_000_000 {
        format!("{:.1}M views", count as f64 / 1_000_000.0)
    } else if count >= 1_000 {
        format!("{:.0}K views", count as f64 / 1_000.0)
    } else {
        format!("{count} views")
    }
}

#[cfg(windows)]
fn terminate_process(pid: u32) -> Result<(), String> {
    let status = Command::new("taskkill")
        .args(["/PID", &pid.to_string(), "/T", "/F"])
        .status()
        .map_err(|error| format!("Could not stop download: {error}"))?;
    if status.success() {
        Ok(())
    } else {
        Err("Could not stop download process".into())
    }
}

#[cfg(not(windows))]
fn terminate_process(pid: u32) -> Result<(), String> {
    // The sidecar starts as its own process-group leader, so a negative PID
    // terminates Node and its inherited yt-dlp/ffmpeg descendants together.
    let status = Command::new("kill")
        .args(["-TERM", &format!("-{pid}")])
        .status()
        .map_err(|error| format!("Could not stop download: {error}"))?;
    if status.success() {
        Ok(())
    } else {
        Err("Could not stop download process".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn desktop_downloads_delegate_to_lyt_job_events() {
        let args = download_args(
            "desktop-job",
            "https://example.test/video",
            "video",
            "1080p",
            "C:/Downloads",
        );

        assert_eq!(args[0], "--events-jsonl");
        assert_eq!(args[1], "--job-id");
        assert_eq!(args[2], "desktop-job");
        assert_eq!(args[3], "--output-dir");
        assert!(args
            .windows(2)
            .any(|pair| pair[0] == "--quality" && pair[1] == "1080p"));
        assert_eq!(args[args.len() - 2], "--");
        assert_eq!(args[args.len() - 1], "https://example.test/video");
        assert!(!args.iter().any(|arg| arg == "yt-dlp"));
    }

    #[test]
    fn sidecar_search_documents_map_to_desktop_results() {
        let document = json!({
            "schema": "lyt.search.v1",
            "results": [{
                "id": "abc",
                "title": "Example",
                "channel": "Channel",
                "durationSeconds": 125,
                "viewCount": 1200,
                "url": "https://example.test/video"
            }]
        });

        let result = entry_to_result(&result_values(&document)[0]);
        assert_eq!(result.id, "abc");
        assert_eq!(result.duration, "2:05");
        assert_eq!(result.views, "1K views");
    }

    #[test]
    fn desktop_expands_tilde_output_folders_before_calling_lyt() {
        let expanded = expand_folder_with_home("~/Downloads", Some("C:/Users/example"));
        assert_eq!(
            PathBuf::from(expanded),
            PathBuf::from("C:/Users/example").join("Downloads")
        );
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(JobRegistry::default())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            search,
            resolve,
            start_download,
            cancel_download
        ])
        .run(tauri::generate_context!())
        .expect("error while running lyt");
}
