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
$H = 448
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

function Draw-Atmosphere($g, $rng, [string]$moodKey) {
  $colors = $moods[$moodKey]
  $primary = Color-Hex (Pick $rng $colors) (Next-Int $rng 18 48)
  $secondary = Color-Hex (Pick $rng $colors) (Next-Int $rng 14 36)

  $topWash = New-Object System.Drawing.Drawing2D.LinearGradientBrush `
    ((New-Object System.Drawing.Rectangle 0, 0, $W, $H)), `
    ([System.Drawing.Color]::FromArgb(34, $primary)), `
    ([System.Drawing.Color]::FromArgb(14, 2, 4, 12)), 90
  $g.FillRectangle($topWash, 0, 0, $W, $H)
  $topWash.Dispose()

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

function Render-Card([string]$id, [string]$moodKey, [int]$serial, [bool]$meteor) {
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
    $warmth = ((Next-Float $rng) - 0.5) * 0.12
    $brightness = 0.94 + ((Next-Float $rng) * 0.18)
    $zoomBias = (Next-Float $rng) * 0.08
    Draw-CoverCrop $g $primary $rng 1.0 $brightness $warmth $zoomBias
    Draw-CoverCrop $g $secondary $rng (0.08 + ((Next-Float $rng) * 0.1)) 1.0 (-$warmth * 0.4) 0.0
    Draw-Atmosphere $g $rng $moodKey

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
  Render-Card "region-$serial" $biome $serial $false
}

for ($index = 0; $index -lt 45; $index += 1) {
  Render-Card "sanctuary-$($index + 1)" "sanctuary" ($index + 1) $false
}

for ($serial = 69; $serial -le 83; $serial += 1) {
  $biome = $biomes[($serial + 1) % $biomes.Count]
  Render-Card "meteor-$serial" $biome $serial $true
}

Write-Host "Generated 128 clean cyberpunk card images in $target"
