Set-Location (Join-Path $PSScriptRoot "..\\backend")
uvicorn app.main:app --reload
