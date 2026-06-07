use serde::Serialize;
use serde_json::Value;
use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};
use tauri::{AppHandle, Emitter};

#[derive(Serialize, Clone)]
struct SearchResult {
    title: String,
    channel: String,
    duration: String,
    views: String,
    url: String,
    thumbnail: Option<String>,
}

#[derive(Serialize, Clone)]
struct Progress {
    percent: f64,
    detail: String,
    status: String,
}

// Search YouTube via yt-dlp's built-in search (no API key required).
#[tauri::command]
fn search(query: String) -> Result<Vec<SearchResult>, String> {
    let output = Command::new("yt-dlp")
        .args([
            &format!("ytsearch20:{query}"),
            "-J",
            "--flat-playlist",
            "--no-warnings",
        ])
        .output()
        .map_err(|e| format!("Could not run yt-dlp: {e}. Is it installed?"))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }

    let root: Value = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Could not parse yt-dlp output: {e}"))?;

    let entries = root
        .get("entries")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();

    Ok(entries.iter().map(entry_to_result).collect())
}

// Resolve a single pasted URL into one result.
#[tauri::command]
fn resolve(url: String) -> Result<Vec<SearchResult>, String> {
    let output = Command::new("yt-dlp")
        .args(["-J", "--no-playlist", "--no-warnings", "--", &url])
        .output()
        .map_err(|e| format!("Could not run yt-dlp: {e}. Is it installed?"))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }

    let info: Value = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Could not parse yt-dlp output: {e}"))?;

    Ok(vec![entry_to_result(&info)])
}

// Start a download, returning an id immediately. Progress is streamed back to
// the frontend as `progress:{id}` events.
#[tauri::command]
fn start_download(
    app: AppHandle,
    url: String,
    kind: String,
    quality: String,
    folder: String,
) -> Result<String, String> {
    let id = format!("dl-{}", now_millis());
    let args = build_args(&url, &kind, &quality, &folder);
    let channel = format!("progress:{id}");

    std::thread::spawn(move || {
        let child = Command::new("yt-dlp")
            .args(&args)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn();

        let mut child = match child {
            Ok(child) => child,
            Err(e) => {
                let _ = app.emit(
                    &channel,
                    Progress { percent: 0.0, detail: format!("yt-dlp error: {e}"), status: "error".into() },
                );
                return;
            }
        };

        if let Some(stdout) = child.stdout.take() {
            for line in BufReader::new(stdout).lines().map_while(Result::ok) {
                if let Some(progress) = parse_progress(&line) {
                    let _ = app.emit(&channel, progress);
                }
            }
        }

        let status = child.wait();
        let done = match status {
            Ok(s) if s.success() => Progress { percent: 100.0, detail: "saved".into(), status: "done".into() },
            _ => Progress { percent: 0.0, detail: "download failed".into(), status: "error".into() },
        };
        let _ = app.emit(&channel, done);
    });

    Ok(id)
}

fn build_args(url: &str, kind: &str, quality: &str, folder: &str) -> Vec<String> {
    let mut args: Vec<String> = vec![
        "--newline".into(),
        "--no-warnings".into(),
        "--progress".into(),
        "--no-playlist".into(),
        "-o".into(),
        format!("{folder}/%(title).180B [%(id)s].%(ext)s"),
    ];

    if kind == "video" {
        let format = match height_for(quality) {
            Some(h) => format!("bestvideo[height<={h}]+bestaudio/best[height<={h}]"),
            None => "bestvideo+bestaudio/best".into(),
        };
        args.push("-f".into());
        args.push(format);
        args.push("--merge-output-format".into());
        args.push("mp4".into());
    } else if let Some(bitrate) = mp3_bitrate(quality) {
        args.push("-f".into());
        args.push("bestaudio".into());
        args.push("-x".into());
        args.push("--audio-format".into());
        args.push("mp3".into());
        args.push("--audio-quality".into());
        args.push(bitrate.into());
    } else {
        args.push("-f".into());
        args.push("bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio".into());
    }

    args.push("--".into());
    args.push(url.into());
    args
}

fn height_for(quality: &str) -> Option<u32> {
    match quality {
        "2160p" => Some(2160),
        "1440p" => Some(1440),
        "1080p" => Some(1080),
        "720p" => Some(720),
        "480p" => Some(480),
        _ => None, // "best"
    }
}

fn mp3_bitrate(quality: &str) -> Option<&'static str> {
    match quality {
        "mp3-320" => Some("320K"),
        "mp3-192" => Some("192K"),
        "mp3-128" => Some("128K"),
        _ => None, // "best" -> native
    }
}

fn parse_progress(line: &str) -> Option<Progress> {
    let marker = "[download]";
    let rest = line.trim().strip_prefix(marker)?.trim_start();
    let percent_str = rest.split('%').next()?.trim();
    let percent: f64 = percent_str.parse().ok()?;
    let detail = rest
        .split("at ")
        .nth(1)
        .map(|s| s.trim().to_string())
        .unwrap_or_default();

    Some(Progress { percent, detail, status: "downloading".into() })
}

fn entry_to_result(entry: &Value) -> SearchResult {
    let id = entry.get("id").and_then(Value::as_str).unwrap_or("");
    let url = entry
        .get("webpage_url")
        .and_then(Value::as_str)
        .map(str::to_string)
        .unwrap_or_else(|| format!("https://www.youtube.com/watch?v={id}"));

    SearchResult {
        title: entry.get("title").and_then(Value::as_str).unwrap_or("Untitled").to_string(),
        channel: entry
            .get("channel")
            .or_else(|| entry.get("uploader"))
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string(),
        duration: format_duration(entry.get("duration").and_then(Value::as_f64)),
        views: format_views(entry.get("view_count").and_then(Value::as_f64)),
        url,
        thumbnail: pick_thumbnail(entry),
    }
}

fn pick_thumbnail(entry: &Value) -> Option<String> {
    if let Some(t) = entry.get("thumbnail").and_then(Value::as_str) {
        return Some(t.to_string());
    }
    entry
        .get("thumbnails")
        .and_then(Value::as_array)
        .and_then(|arr| arr.last())
        .and_then(|t| t.get("url"))
        .and_then(Value::as_str)
        .map(str::to_string)
}

fn format_duration(seconds: Option<f64>) -> String {
    let Some(total) = seconds.map(|s| s as u64) else {
        return String::new();
    };
    let (h, m, s) = (total / 3600, (total % 3600) / 60, total % 60);
    if h > 0 {
        format!("{h}:{m:02}:{s:02}")
    } else {
        format!("{m}:{s:02}")
    }
}

fn format_views(count: Option<f64>) -> String {
    let Some(n) = count.map(|c| c as u64) else {
        return String::new();
    };
    if n >= 1_000_000 {
        format!("{:.1}M views", n as f64 / 1_000_000.0)
    } else if n >= 1_000 {
        format!("{:.0}K views", n as f64 / 1_000.0)
    } else {
        format!("{n} views")
    }
}

fn now_millis() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![search, resolve, start_download])
        .run(tauri::generate_context!())
        .expect("error while running lyt");
}
