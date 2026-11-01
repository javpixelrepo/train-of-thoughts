$videoScript = Join-Path $PSScriptRoot 'video-server.py'
try { $videoHealth = Invoke-RestMethod 'http://127.0.0.1:4174/health' -TimeoutSec 2; if ($videoHealth.ready) { exit 0 } } catch {}
Start-Process -FilePath 'python.exe' -ArgumentList ('"' + $videoScript + '"') -WindowStyle Hidden
