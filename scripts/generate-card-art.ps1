param(
  [string]$OutputDir = "src/assets/card-art/generated"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$target = Join-Path $root $OutputDir
$sourceDir = Join-Path $root "src/assets/card-art"
New-Item -ItemType Directory -Force -Path $target | Out-Null

$W = 768
$H = 814
$Aspect = $W / [double]$H

$imageCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
  Where-Object { $_.MimeType -eq "image/jpeg" } |
  Select-Object -First 1
$encoderParameters = New-Object System.Drawing.Imaging.EncoderParameters 1
$encoderParameters.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter `
  ([System.Drawing.Imaging.Encoder]::Quality), 93L

$artPools = @{
  river = @("river-cyberpunk.jpg", "river-cyberpunk-2.jpg", "river-cyberpunk-3.jpg")
  city = @("city-cyberpunk.jpg", "city-cyberpunk-2.jpg", "city-cyberpunk-3.jpg")
  forest = @("forest-cyberpunk.jpg", "forest-cyberpunk-2.jpg", "forest-cyberpunk-3.jpg")
  desert = @("desert-cyberpunk.jpg", "desert-cyberpunk-2.jpg", "desert-cyberpunk-3.jpg")
  sanctuary = @("sanctuary-cyberpunk.jpg", "sanctuary-cyberpunk-2.jpg", "sanctuary-cyberpunk-3.jpg")
  meteor = @("city-cyberpunk-3.jpg", "desert-cyberpunk-2.jpg", "river-cyberpunk-3.jpg", "forest-cyberpunk-2.jpg")
}

$moods = @{
  river = @("#24e6ff", "#2b79ff", "#d454ff")
  city = @("#ff42d6", "#35eaff", "#8f6dff")
  forest = @("#66ff87", "#35ffe7", "#bd5cff")
  desert = @("#ffd15e", "#ff7b3e", "#4be8ff")
  sanctuary = @("#57eaff", "#ffe181", "#b986ff")
  meteor = @("#ffef7a", "#ff4d6d", "#42f5ff")
}

function Hash-String([string]$value) {
  $hash = [uint64]2166136261
  foreach ($char in $value.ToCharArray()) {
    $hash = (($hash -bxor [uint64][int][char]$char) * 16777619) % 4294967296
  }
  return $hash
}

function New-Rng([uint64]$seed) {
  return [pscustomobject]@{ State = [uint32]($seed % 4294967296) }
}

function Next-Raw($rng) {
  $rng.State = [uint32]((([uint64]$rng.State * 1664525 + 1013904223) % 4294967296))
  return $rng.State
}

function Next-Float($rng) {
  return ([double](Next-Raw $rng)) / 4294967295.0
}

function Next-Int($rng, [int]$min, [int]$maxExclusive) {
  return $min + [int][Math]::Floor((Next-Float $rng) * ($maxExclusive - $min))
}

function Pick($rng, [object[]]$items) {
  return $items[(Next-Int $rng 0 $items.Count)]
}

function Color-Hex([string]$hex, [int]$alpha = 255) {
  $clean = $hex.TrimStart("#")
  return [System.Drawing.Color]::FromArgb(
    $alpha,
    [Convert]::ToInt32($clean.Substring(0, 2), 16),
    [Convert]::ToInt32($clean.Substring(2, 2), 16),
    [Convert]::ToInt32($clean.Substring(4, 2), 16)
  )
}

function New-ImageAttributes([float]$alpha, [float]$brightness, [float]$warmth) {
  $attrs = New-Object System.Drawing.Imaging.ImageAttributes
  $matrix = New-Object System.Drawing.Imaging.ColorMatrix
  $matrix.Matrix00 = [Math]::Max(0.7, [Math]::Min(1.35, $brightness + $warmth))
  $matrix.Matrix11 = [Math]::Max(0.7, [Math]::Min(1.35, $brightness))
  $matrix.Matrix22 = [Math]::Max(0.7, [Math]::Min(1.35, $brightness - $warmth))
  $matrix.Matrix33 = $alpha
  $matrix.Matrix40 = -0.015
  $matrix.Matrix41 = -0.015
  $matrix.Matrix42 = -0.01
  $attrs.SetColorMatrix($matrix, [System.Drawing.Imaging.ColorMatrixFlag]::Default, [System.Drawing.Imaging.ColorAdjustType]::Bitmap)
  return $attrs
}

function Draw-CoverCrop($g, [string]$fileName, $rng, [float]$alpha, [float]$brightness, [float]$warmth, [double]$zoomBias) {
  $path = Join-Path $sourceDir $fileName
  $img = [System.Drawing.Image]::FromFile($path)
  $attrs = New-ImageAttributes $alpha $brightness $warmth

  try {
    $cropW = [int]($img.Width * (0.55 + (Next-Float $rng) * 0.36 - $zoomBias))
    $cropW = [Math]::Max([int]($img.Width * 0.42), [Math]::Min($img.Width, $cropW))
    $cropH = [int]($cropW / $Aspect)
    if ($cropH -gt $img.Height) {
      $cropH = [int]($img.Height * (0.58 + (Next-Float $rng) * 0.32 - ($zoomBias * 0.7)))
      $cropH = [Math]::Max([int]($img.Height * 0.42), [Math]::Min($img.Height, $cropH))
      $cropW = [int]($cropH * $Aspect)
    }

    $maxX = [Math]::Max(1, $img.Width - $cropW)
    $maxY = [Math]::Max(1, $img.Height - $cropH)
    $srcX = Next-Int $rng 0 $maxX
    $srcY = Next-Int $rng 0 $maxY

    $dest = New-Object System.Drawing.Rectangle 0, 0, $W, $H
    $g.DrawImage($img, $dest, $srcX, $srcY, $cropW, $cropH, [System.Drawing.GraphicsUnit]::Pixel, $attrs)
  } finally {
    $attrs.Dispose()
    $img.Dispose()
  }
}

function Draw-ContainImage($g, [string]$fileName, [float]$alpha, [float]$brightness, [float]$warmth) {
  $path = Join-Path $sourceDir $fileName
  $img = [System.Drawing.Image]::FromFile($path)
  $attrs = New-ImageAttributes $alpha $brightness $warmth

  try {
    $scale = [Math]::Min($W / [double]$img.Width, $H / [double]$img.Height)
    $destW = [int]($img.Width * $scale)
    $destH = [int]($img.Height * $scale)
    $destX = [int](($W - $destW) / 2)
    $destY = [int](($H - $destH) / 2)
    $dest = New-Object System.Drawing.Rectangle $destX, $destY, $destW, $destH
    $g.DrawImage($img, $dest, 0, 0, $img.Width, $img.Height, [System.Drawing.GraphicsUnit]::Pixel, $attrs)
  } finally {
    $attrs.Dispose()
    $img.Dispose()
  }
}

function Draw-CardBase($g, $rng, [string]$moodKey, [string]$lightMode) {
  $colors = $moods[$moodKey]
  $top = Color-Hex (Pick $rng $colors) 255
  $bottom = if ($lightMode -eq "night") {
    [System.Drawing.Color]::FromArgb(255, 3, 5, 18)
  } elseif ($lightMode -eq "day") {
    [System.Drawing.Color]::FromArgb(255, 34, 50, 68)
  } else {
    [System.Drawing.Color]::FromArgb(255, 14, 14, 28)
  }

  $topAlpha = if ($lightMode -eq "day") { 118 } else { 86 }
  $baseBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush `
    ((New-Object System.Drawing.Rectangle 0, 0, $W, $H)), `
    ([System.Drawing.Color]::FromArgb($topAlpha, $top)), `
    $bottom, 90
  $g.FillRectangle($baseBrush, 0, 0, $W, $H)
  $baseBrush.Dispose()

  for ($i = 0; $i -lt 5; $i += 1) {
    $accent = Color-Hex (Pick $rng $colors) (Next-Int $rng 10 24)
    $brush = New-Object System.Drawing.SolidBrush $accent
    $x = Next-Int $rng -120 620
    $y = Next-Int $rng -40 760
    $g.FillEllipse($brush, $x, $y, (Next-Int $rng 140 420), (Next-Int $rng 42 150))
    $brush.Dispose()
  }
}

function Draw-Atmosphere($g, $rng, [string]$moodKey, [string]$lightMode) {
  $colors = $moods[$moodKey]
  $primary = Color-Hex (Pick $rng $colors) (Next-Int $rng 18 48)
  $secondary = Color-Hex (Pick $rng $colors) (Next-Int $rng 14 36)

  $topWash = New-Object System.Drawing.Drawing2D.LinearGradientBrush `
    ((New-Object System.Drawing.Rectangle 0, 0, $W, $H)), `
    ([System.Drawing.Color]::FromArgb(34, $primary)), `
    ([System.Drawing.Color]::FromArgb(14, 2, 4, 12)), 90
  $g.FillRectangle($topWash, 0, 0, $W, $H)
  $topWash.Dispose()

  if ($lightMode -eq "night") {
    $nightBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush `
      ((New-Object System.Drawing.Rectangle 0, 0, $W, $H)), `
      ([System.Drawing.Color]::FromArgb(86, 2, 5, 22)), `
      ([System.Drawing.Color]::FromArgb(118, 2, 4, 16)), 90
    $g.FillRectangle($nightBrush, 0, 0, $W, $H)
    $nightBrush.Dispose()
  } elseif ($lightMode -eq "day") {
    $dayBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush `
      ((New-Object System.Drawing.Rectangle 0, 0, $W, $H)), `
      ([System.Drawing.Color]::FromArgb(34, 255, 232, 156)), `
      ([System.Drawing.Color]::FromArgb(16, 104, 240, 255)), 90
    $g.FillRectangle($dayBrush, 0, 0, $W, $H)
    $dayBrush.Dispose()
  }

  for ($i = 0; $i -lt 2; $i += 1) {
    $alpha = Next-Int $rng 3 9
    $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb($alpha, $secondary))
    $x = Next-Int $rng -180 660
    $y = Next-Int $rng 18 330
    $g.FillEllipse($brush, $x, $y, (Next-Int $rng 220 560), (Next-Int $rng 45 150))
    $brush.Dispose()
  }

  $shade = New-Object System.Drawing.Drawing2D.GraphicsPath
  $shade.AddEllipse(-140, -110, $W + 280, $H + 220)
  $vignette = New-Object System.Drawing.Drawing2D.PathGradientBrush $shade
  $vignette.CenterColor = [System.Drawing.Color]::FromArgb(0, 0, 0, 0)
  $vignette.SurroundColors = @([System.Drawing.Color]::FromArgb(118, 0, 0, 0))
  $g.FillRectangle($vignette, 0, 0, $W, $H)
  $vignette.Dispose()
  $shade.Dispose()
}

function Render-Card([string]$id, [string]$moodKey, [int]$serial, [bool]$meteor, [string]$lightMode = "neutral") {
  $seed = ((Hash-String $id) + ([uint64]$serial * 2654435761)) % 4294967296
  $rng = New-Rng $seed
  $poolKey = if ($meteor) { "meteor" } else { $moodKey }
  $primary = Pick $rng $artPools[$poolKey]
  $secondary = Pick $rng $artPools[$poolKey]
  if ($secondary -eq $primary -and $artPools[$poolKey].Count -gt 1) {
    $secondaryIndex = ([Array]::IndexOf($artPools[$poolKey], $primary) + 1) % $artPools[$poolKey].Count
    $secondary = $artPools[$poolKey][$secondaryIndex]
  }

  $bitmap = New-Object System.Drawing.Bitmap $W, $H
  $g = [System.Drawing.Graphics]::FromImage($bitmap)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

  try {
    $isNight = $lightMode -eq "night"
    $isDay = $lightMode -eq "day"
    $warmth = if ($isNight) { -0.16 - ((Next-Float $rng) * 0.08) } elseif ($isDay) { 0.08 + ((Next-Float $rng) * 0.1) } else { ((Next-Float $rng) - 0.5) * 0.12 }
    $brightness = if ($isNight) { 0.62 + ((Next-Float $rng) * 0.12) } elseif ($isDay) { 1.12 + ((Next-Float $rng) * 0.18) } else { 0.94 + ((Next-Float $rng) * 0.18) }
    Draw-CardBase $g $rng $moodKey $lightMode
    Draw-ContainImage $g $secondary 0.3 $brightness $warmth
    Draw-ContainImage $g $primary 0.98 $brightness $warmth
    Draw-Atmosphere $g $rng $moodKey $lightMode

    $out = Join-Path $target "$id.jpg"
    $bitmap.Save($out, $imageCodec, $encoderParameters)
  } finally {
    $g.Dispose()
    $bitmap.Dispose()
  }
}

$biomes = @("river", "city", "forest", "desert")

for ($serial = 1; $serial -le 68; $serial += 1) {
  $biome = $biomes[$serial % $biomes.Count]
  $time = if ($serial % 3 -eq 0) { "night" } else { "day" }
  Render-Card "region-$serial" $biome $serial $false $time
}

for ($index = 0; $index -lt 45; $index += 1) {
  Render-Card "sanctuary-$($index + 1)" "sanctuary" ($index + 1) $false "neutral"
}

for ($serial = 69; $serial -le 83; $serial += 1) {
  $biome = $biomes[($serial + 1) % $biomes.Count]
  $time = if ($serial % 2 -eq 0) { "night" } else { "day" }
  Render-Card "meteor-$serial" $biome $serial $true $time
}

Write-Host "Generated 128 clean cyberpunk card images in $target"
