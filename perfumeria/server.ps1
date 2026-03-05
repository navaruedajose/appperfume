$port = 3000
$root = $PSScriptRoot
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://localhost:${port}/")
$listener.Start()
Write-Host ""
Write-Host "  PerfumeFlow corriendo en:" -ForegroundColor Green
Write-Host "  http://localhost:${port}" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Presiona Ctrl+C para detener." -ForegroundColor Gray
Write-Host ""

$mimeTypes = @{
  '.html' = 'text/html; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.js'   = 'application/javascript; charset=utf-8'
  '.png'  = 'image/png'
  '.jpg'  = 'image/jpeg'
  '.ico'  = 'image/x-icon'
  '.svg'  = 'image/svg+xml'
  '.json' = 'application/json'
}

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
    $req = $ctx.Request
    $res = $ctx.Response

    $path = $req.Url.LocalPath -replace '/', '\'
    if ($path -eq '\' -or $path -eq '') { $path = '\index.html' }

    $filePath = Join-Path $root $path.TrimStart('\')

    if (Test-Path $filePath -PathType Leaf) {
      $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
      $mime = if ($mimeTypes.ContainsKey($ext)) { $mimeTypes[$ext] } else { 'application/octet-stream' }
      $bytes = [System.IO.File]::ReadAllBytes($filePath)
      $res.ContentType = $mime
      $res.ContentLength64 = $bytes.Length
      $res.StatusCode = 200
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      # SPA fallback - serve index.html
      $indexPath = Join-Path $root 'index.html'
      $bytes = [System.IO.File]::ReadAllBytes($indexPath)
      $res.ContentType = 'text/html; charset=utf-8'
      $res.ContentLength64 = $bytes.Length
      $res.StatusCode = 200
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    }
    $res.OutputStream.Close()
  } catch {
    # Continue on error
  }
}
