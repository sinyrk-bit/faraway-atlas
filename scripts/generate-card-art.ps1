param(
  [string]$OutputDir = "src/assets/card-art/generated"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$target = Join-Path $root $OutputDir
New-Item -ItemType Directory -Force -Path $target | Out-Null

$imageCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
  Where-Object { $_.MimeType -eq "image/jpeg" } |
  Select-Object -First 1

$encoderParameters = New-Object System.Drawing.Imaging.EncoderParameters 1
$encoderParameters.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter `
  ([System.Drawing.Imaging.Encoder]::Quality), 92L

$W = 768
$H = 448

function Color-Hex([string]$hex, [int]$alpha = 255) {
  $clean = $hex.TrimStart("#")
  return [System.Drawing.Color]::FromArgb(
    $alpha,
    [Convert]::ToInt32($clean.Substring(0, 2), 16),
    [Convert]::ToInt32($clean.Substring(2, 2), 16),
    [Convert]::ToInt32($clean.Substring(4, 2), 16)
  )
}

function Mix-Color([System.Drawing.Color]$a, [System.Drawing.Color]$b, [double]$t, [int]$alpha = 255) {
  $r = [int]($a.R + (($b.R - $a.R) * $t))
  $g = [int]($a.G + (($b.G - $a.G) * $t))
  $bb = [int]($a.B + (($b.B - $a.B) * $t))
  return [System.Drawing.Color]::FromArgb($alpha, $r, $g, $bb)
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

function Hash-String([string]$value) {
  $hash = [uint64]2166136261
  foreach ($char in $value.ToCharArray()) {
    $hash = (($hash -bxor [uint64][int][char]$char) * 16777619) % 4294967296
  }
  return $hash
}

function Fill-Polygon($g, [System.Drawing.Brush]$brush, [object[]]$points) {
  $typed = New-Object System.Drawing.PointF[] $points.Count
  for ($i = 0; $i -lt $points.Count; $i += 1) {
    $typed[$i] = New-Object System.Drawing.PointF ([float]$points[$i][0]), ([float]$points[$i][1])
  }
  $g.FillPolygon($brush, $typed)
}

function Draw-LineGlow($g, [System.Drawing.Color]$color, [float]$x1, [float]$y1, [float]$x2, [float]$y2, [float]$width) {
  $glow = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(48, $color)), ($width * 3)
  $core = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(215, $color)), $width
  $glow.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $glow.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $core.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $core.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $g.DrawLine($glow, $x1, $y1, $x2, $y2)
  $g.DrawLine($core, $x1, $y1, $x2, $y2)
  $glow.Dispose()
  $core.Dispose()
}

function Fill-EllipseGlow($g, [System.Drawing.Color]$color, [float]$x, [float]$y, [float]$w, [float]$h) {
  for ($i = 4; $i -ge 1; $i -= 1) {
    $alpha = 14 * $i
    $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb($alpha, $color))
    $padX = $w * 0.33 * $i
    $padY = $h * 0.33 * $i
    $g.FillEllipse($brush, $x - $padX, $y - $padY, $w + ($padX * 2), $h + ($padY * 2))
    $brush.Dispose()
  }
  $core = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(215, $color))
  $g.FillEllipse($core, $x, $y, $w, $h)
  $core.Dispose()
}

function Draw-Background($g, $rng, [hashtable]$palette, [bool]$night) {
  $top = Color-Hex $palette.top
  $mid = Color-Hex $palette.mid
  $bottom = Color-Hex $palette.bottom

  for ($y = 0; $y -lt $H; $y += 1) {
    $t = $y / [double]($H - 1)
    $c = if ($t -lt 0.58) {
      Mix-Color $top $mid ($t / 0.58)
    } else {
      Mix-Color $mid $bottom (($t - 0.58) / 0.42)
    }
    $pen = New-Object System.Drawing.Pen $c
    $g.DrawLine($pen, 0, $y, $W, $y)
    $pen.Dispose()
  }

  $hazeColor = Color-Hex $palette.haze 80
  for ($i = 0; $i -lt 7; $i += 1) {
    $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb((Next-Int $rng 14 42), $hazeColor))
    $x = Next-Int $rng -180 680
    $y = Next-Int $rng 20 300
    $g.FillEllipse($brush, $x, $y, (Next-Int $rng 220 620), (Next-Int $rng 45 140))
    $brush.Dispose()
  }

  $orb = if ($night) { Color-Hex $palette.moon 205 } else { Color-Hex $palette.sun 210 }
  Fill-EllipseGlow $g $orb (Next-Int $rng 495 690) (Next-Int $rng 24 92) (Next-Int $rng 34 78) (Next-Int $rng 34 78)

  $starPen = New-Object System.Drawing.Pen (Color-Hex $palette.star 92), 1
  for ($i = 0; $i -lt 72; $i += 1) {
    $x = Next-Int $rng 0 $W
    $y = Next-Int $rng 0 230
    $len = Next-Int $rng 1 4
    $g.DrawLine($starPen, $x, $y, $x + $len, $y)
  }
  $starPen.Dispose()
}

function Draw-BackdropTexture($g, $rng, [string]$biome, [string]$kind, [bool]$meteor) {
  $artDir = Join-Path $root "src/assets/card-art"
  $sources = if ($meteor) {
    @("city-cyberpunk.jpg", "desert-cyberpunk-2.jpg", "river-cyberpunk-3.jpg")
  } elseif ($kind -eq "sanctuary") {
    @("sanctuary-cyberpunk.jpg", "sanctuary-cyberpunk-2.jpg", "sanctuary-cyberpunk-3.jpg")
  } else {
    @("$biome-cyberpunk.jpg", "$biome-cyberpunk-2.jpg", "$biome-cyberpunk-3.jpg")
  }

  $sourcePath = Join-Path $artDir (Pick $rng $sources)
  if (!(Test-Path -LiteralPath $sourcePath)) {
    return
  }

  $img = [System.Drawing.Image]::FromFile($sourcePath)
  $attrs = New-Object System.Drawing.Imaging.ImageAttributes
  $matrix = New-Object System.Drawing.Imaging.ColorMatrix
  $matrix.Matrix00 = 1.08
  $matrix.Matrix11 = 1.08
  $matrix.Matrix22 = 1.12
  $matrix.Matrix33 = 0.64
  $attrs.SetColorMatrix($matrix, [System.Drawing.Imaging.ColorMatrixFlag]::Default, [System.Drawing.Imaging.ColorAdjustType]::Bitmap)

  try {
    $ratio = $W / [double]$H
    $cropW = [int]($img.Width * (0.62 + (Next-Float $rng) * 0.3))
    $cropH = [int]($cropW / $ratio)
    if ($cropH -gt $img.Height) {
      $cropH = [int]($img.Height * (0.68 + (Next-Float $rng) * 0.25))
      $cropW = [int]($cropH * $ratio)
    }
    $cropW = [Math]::Min($cropW, $img.Width)
    $cropH = [Math]::Min($cropH, $img.Height)
    $srcX = Next-Int $rng 0 ([Math]::Max(1, $img.Width - $cropW))
    $srcY = Next-Int $rng 0 ([Math]::Max(1, $img.Height - $cropH))
    $dest = New-Object System.Drawing.Rectangle 0, 0, $W, $H

    $g.DrawImage(
      $img,
      $dest,
      $srcX,
      $srcY,
      $cropW,
      $cropH,
      [System.Drawing.GraphicsUnit]::Pixel,
      $attrs
    )
  } finally {
    $attrs.Dispose()
    $img.Dispose()
  }
}

function Draw-ScanTexture($g, $rng, [System.Drawing.Color]$accent) {
  $scan = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(6, 255, 255, 255)), 1
  for ($y = 6; $y -lt $H; $y += 18) {
    $g.DrawLine($scan, 0, $y, $W, $y)
  }
  $scan.Dispose()

  for ($i = 0; $i -lt 2; $i += 1) {
    $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb((Next-Int $rng 18 42), $accent)), 1
    $x1 = Next-Int $rng -60 820
    $y1 = Next-Int $rng 35 360
    $x2 = $x1 + (Next-Int $rng -260 260)
    $y2 = $y1 + (Next-Int $rng -80 80)
    $g.DrawLine($pen, $x1, $y1, $x2, $y2)
    $pen.Dispose()
  }

  for ($i = 0; $i -lt 8; $i += 1) {
    $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb((Next-Int $rng 14 42), $accent))
    $g.FillRectangle($brush, (Next-Int $rng 0 $W), (Next-Int $rng 0 $H), (Next-Int $rng 2 22), (Next-Int $rng 1 4))
    $brush.Dispose()
  }
}

function Draw-Skyline($g, $rng, [System.Drawing.Color]$dark, [System.Drawing.Color]$accent, [int]$baseY, [int]$layers) {
  for ($layer = 0; $layer -lt $layers; $layer += 1) {
    $alpha = 120 + ($layer * 35)
    $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb([Math]::Min(240, $alpha), $dark))
    $x = -20
    while ($x -lt $W + 40) {
      $bw = Next-Int $rng 28 82
      $bh = Next-Int $rng (70 + $layer * 28) (190 + $layer * 34)
      $top = $baseY - $bh + (Next-Int $rng -18 28)
      $g.FillRectangle($brush, $x, $top, $bw, $baseY - $top + 22)

      if ((Next-Int $rng 0 4) -eq 0) {
        $spire = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb([Math]::Min(230, $alpha + 20), $dark))
        Fill-Polygon $g $spire @(@(($x + $bw * 0.35), $top), @(($x + $bw * 0.5), ($top - (Next-Int $rng 24 72))), @(($x + $bw * 0.65), $top))
        $spire.Dispose()
      }

      $windowBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb((Next-Int $rng 80 180), $accent))
      for ($wy = $top + 16; $wy -lt $baseY - 8; $wy += (Next-Int $rng 15 25)) {
        if ((Next-Int $rng 0 3) -ne 0) {
          $g.FillRectangle($windowBrush, $x + (Next-Int $rng 6 ([Math]::Max(8, $bw - 8))), $wy, (Next-Int $rng 4 15), 2)
        }
      }
      $windowBrush.Dispose()

      $x += $bw + (Next-Int $rng 2 18)
    }
    $brush.Dispose()
  }
}

function Draw-RiverScene($g, $rng, [hashtable]$palette, [int]$serial, [bool]$meteor) {
  $accent = Color-Hex $palette.accent
  $dark = Color-Hex "#061423"
  Draw-Skyline $g $rng $dark $accent (Next-Int $rng 230 280) 2

  $waterTop = Next-Int $rng 245 302
  $water = New-Object System.Drawing.Drawing2D.LinearGradientBrush `
    ((New-Object System.Drawing.Rectangle 0, $waterTop, $W, ($H - $waterTop))), `
    (Color-Hex "#06223b"), (Color-Hex $palette.water), 90
  $g.FillRectangle($water, 0, $waterTop, $W, $H - $waterTop)
  $water.Dispose()

  for ($i = 0; $i -lt 6; $i += 1) {
    Draw-LineGlow $g $accent (Next-Int $rng -80 180) ($waterTop + (Next-Int $rng 12 132)) (Next-Int $rng 560 860) ($waterTop + (Next-Int $rng 18 145)) (Next-Int $rng 1 4)
  }

  $bridgeY = Next-Int $rng 180 262
  Draw-LineGlow $g (Color-Hex "#b6f7ff") -30 $bridgeY ($W + 40) ($bridgeY + (Next-Int $rng -24 28)) 4
  for ($x = Next-Int $rng -30 40; $x -lt $W + 30; $x += Next-Int $rng 58 96) {
    Draw-LineGlow $g $accent $x ($bridgeY - 14) ($x + (Next-Int $rng 20 44)) ($waterTop + 98) 2
  }

  for ($i = 0; $i -lt 4; $i += 1) {
    $x = Next-Int $rng 40 650
    $y = Next-Int $rng ($waterTop + 52) ($H - 44)
    $boat = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(205, 3, 12, 22))
    Fill-Polygon $g $boat @(@($x, $y), @(($x + 72), ($y + 3)), @(($x + 51), ($y + 19)), @(($x + 12), ($y + 16)))
    $boat.Dispose()
    Draw-LineGlow $g $accent ($x + 14) ($y - 2) ($x + 55) ($y - 1) 2
  }
}

function Draw-CityScene($g, $rng, [hashtable]$palette, [int]$serial, [bool]$meteor) {
  $accent = Color-Hex $palette.accent
  $pink = Color-Hex "#ff4fe4"
  $dark = Color-Hex "#050717"
  Draw-Skyline $g $rng $dark $accent (Next-Int $rng 265 330) 3

  for ($i = 0; $i -lt 3; $i += 1) {
    $x = Next-Int $rng 30 680
    Draw-LineGlow $g (Pick $rng @($accent, $pink, (Color-Hex "#f6ff78"))) $x (Next-Int $rng 38 118) ($x + (Next-Int $rng -80 80)) (Next-Int $rng 220 365) (Next-Int $rng 2 4)
  }

  $roadY = Next-Int $rng 318 370
  $road = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(226, 4, 5, 13))
  Fill-Polygon $g $road @(@(0, $H), @($W, $H), @((Next-Int $rng 470 610), $roadY), @((Next-Int $rng 140 300), $roadY))
  $road.Dispose()
  for ($i = 0; $i -lt 4; $i += 1) {
    $t = $i / 8.0
    Draw-LineGlow $g $accent ($W / 2 - 10 + $i * 5) ($roadY + $i * 8) ($W / 2 + (Next-Int $rng -70 70)) ($H + 30) 1.5
  }

  for ($i = 0; $i -lt 3; $i += 1) {
    $x = Next-Int $rng 60 620
    $y = Next-Int $rng 155 270
    $panel = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(34, $accent))
    $g.FillRectangle($panel, $x, $y, (Next-Int $rng 55 115), (Next-Int $rng 22 48))
    $panel.Dispose()
    Draw-LineGlow $g (Pick $rng @($accent, $pink)) $x $y ($x + (Next-Int $rng 55 115)) $y 2
  }
}

function Draw-ForestScene($g, $rng, [hashtable]$palette, [int]$serial, [bool]$meteor) {
  $accent = Color-Hex $palette.accent
  $dark = Color-Hex "#05140b"

  for ($layer = 0; $layer -lt 3; $layer += 1) {
    $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(120 + $layer * 36, $dark))
    for ($i = 0; $i -lt 12; $i += 1) {
      $x = Next-Int $rng -40 760
      $trunkW = Next-Int $rng 10 34
      $topY = Next-Int $rng 62 180
      $g.FillRectangle($brush, $x, $topY, $trunkW, $H - $topY)
      $cap = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(130 + $layer * 26, (Pick $rng @((Color-Hex "#114f2a"), (Color-Hex "#143868"), (Color-Hex "#381b55")))))
      $g.FillEllipse($cap, $x - (Next-Int $rng 35 70), $topY - (Next-Int $rng 16 44), (Next-Int $rng 78 160), (Next-Int $rng 32 75))
      $cap.Dispose()
      if ((Next-Int $rng 0 2) -eq 0) {
        Draw-LineGlow $g $accent ($x + $trunkW / 2) ($topY + 6) ($x + $trunkW / 2 + (Next-Int $rng -22 22)) ($H - 20) 2
      }
    }
    $brush.Dispose()
  }

  for ($i = 0; $i -lt 18; $i += 1) {
    Fill-EllipseGlow $g (Pick $rng @($accent, (Color-Hex "#ff6bf7"), (Color-Hex "#ffee78"))) (Next-Int $rng 10 738) (Next-Int $rng 260 420) (Next-Int $rng 5 15) (Next-Int $rng 5 15)
  }

  $ground = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(230, 3, 14, 11))
  Fill-Polygon $g $ground @(@(0, $H), @($W, $H), @($W, (Next-Int $rng 360 410)), @((Next-Int $rng 440 640), (Next-Int $rng 330 385)), @((Next-Int $rng 160 300), (Next-Int $rng 350 405)), @(0, (Next-Int $rng 335 390)))
  $ground.Dispose()
}

function Draw-DesertScene($g, $rng, [hashtable]$palette, [int]$serial, [bool]$meteor) {
  $accent = Color-Hex $palette.accent
  $dark = Color-Hex "#20120a"

  for ($i = 0; $i -lt 7; $i += 1) {
    $x = Next-Int $rng -40 700
    $y = Next-Int $rng 150 280
    $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb((Next-Int $rng 105 190), $dark))
    Fill-Polygon $g $brush @(@($x, $H), @(($x + (Next-Int $rng 80 170)), $H), @(($x + (Next-Int $rng 74 145)), $y), @(($x + (Next-Int $rng 18 68)), ($y + (Next-Int $rng -18 22))))
    $brush.Dispose()
    Draw-LineGlow $g $accent ($x + 16) ($y + 9) ($x + (Next-Int $rng 78 130)) ($y + (Next-Int $rng 6 32)) 2
  }

  for ($band = 0; $band -lt 5; $band += 1) {
    $sand = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(112 + $band * 22, (Mix-Color (Color-Hex "#513512") (Color-Hex $palette.accent) (0.08 * $band))))
    $y = 300 + $band * 27 + (Next-Int $rng -18 22)
    Fill-Polygon $g $sand @(@(0, $H), @($W, $H), @($W, ($y + (Next-Int $rng -18 24))), @((Next-Int $rng 525 720), ($y + (Next-Int $rng -16 18))), @((Next-Int $rng 250 420), ($y + (Next-Int $rng 10 42))), @(0, $y))
    $sand.Dispose()
  }

  for ($i = 0; $i -lt 2; $i += 1) {
    $x = Next-Int $rng 60 680
    Draw-LineGlow $g (Color-Hex "#fff1a8") $x (Next-Int $rng 72 140) ($x + (Next-Int $rng -80 80)) (Next-Int $rng 320 390) 2
  }
}

function Draw-SanctuaryScene($g, $rng, [hashtable]$palette, [int]$index) {
  $accent = Color-Hex $palette.accent
  $gold = Color-Hex "#ffe47a"
  $dark = Color-Hex "#07101f"

  Draw-Skyline $g $rng $dark $accent (Next-Int $rng 270 330) 1

  $cx = Next-Int $rng 260 500
  $baseY = Next-Int $rng 312 372
  $mainW = Next-Int $rng 170 290
  $mainH = Next-Int $rng 100 170

  $body = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(224, (Pick $rng @((Color-Hex "#182345"), (Color-Hex "#251742"), (Color-Hex "#14313b")))))
  $g.FillRectangle($body, $cx - $mainW / 2, $baseY - $mainH, $mainW, $mainH)
  $g.FillEllipse($body, $cx - $mainW / 2, $baseY - $mainH - ($mainH * 0.55), $mainW, $mainH)
  $body.Dispose()

  Draw-LineGlow $g $gold ($cx - $mainW / 2 + 18) ($baseY - $mainH + 18) ($cx + $mainW / 2 - 18) ($baseY - $mainH + 18) 4
  Draw-LineGlow $g $accent ($cx - $mainW / 2) $baseY ($cx + $mainW / 2) $baseY 5

  for ($i = 0; $i -lt 3; $i += 1) {
    $towerX = $cx + (Next-Int $rng -260 260)
    $towerH = Next-Int $rng 95 210
    $tw = Next-Int $rng 24 55
    $tower = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(210, 9, 17, 31))
    $g.FillRectangle($tower, $towerX - $tw / 2, $baseY - $towerH, $tw, $towerH)
    $g.FillEllipse($tower, $towerX - $tw, $baseY - $towerH - 14, $tw * 2, 28)
    $tower.Dispose()
    Draw-LineGlow $g $accent $towerX ($baseY - $towerH + 12) $towerX ($baseY - 14) 3
  }

  for ($r = 0; $r -lt 3; $r += 1) {
    $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(80 - $r * 12, $accent)), (2 + $r)
    $g.DrawEllipse($pen, $cx - $mainW / 2 - 30 - $r * 28, $baseY - $mainH - 42 - $r * 18, $mainW + 60 + $r * 56, 42 + $r * 18)
    $pen.Dispose()
  }

  Fill-EllipseGlow $g $gold ($cx - 22) ($baseY - $mainH + 42) 44 44
}

function Draw-MeteorScene($g, $rng, [hashtable]$palette, [int]$serial) {
  $accent = Color-Hex $palette.accent
  $hot = Color-Hex "#fffb93"
  $crater = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(190, 22, 8, 20))
  $g.FillEllipse($crater, (Next-Int $rng 220 370), (Next-Int $rng 285 365), (Next-Int $rng 240 390), (Next-Int $rng 58 120))
  $crater.Dispose()

  $endX = Next-Int $rng 330 620
  $endY = Next-Int $rng 160 250
  Draw-LineGlow $g $hot (Next-Int $rng -80 170) (Next-Int $rng 20 120) $endX $endY 8
  Draw-LineGlow $g $accent (Next-Int $rng 20 240) (Next-Int $rng 40 150) ($endX - 10) ($endY + 10) 4
  Fill-EllipseGlow $g $hot ($endX - 18) ($endY - 18) 36 36
}

$palettes = @{
  river = @{
    top = "#031425"; mid = "#06354a"; bottom = "#03101d"; haze = "#2feaff"; accent = "#4df3ff"; water = "#0b5e7a"; sun = "#ffe780"; moon = "#dff8ff"; star = "#d9ffff"
  }
  city = @{
    top = "#10051d"; mid = "#35155e"; bottom = "#050713"; haze = "#ff4fe4"; accent = "#ff57dc"; water = "#333b6e"; sun = "#ffd08a"; moon = "#d8d1ff"; star = "#ffd8ff"
  }
  forest = @{
    top = "#021509"; mid = "#123f24"; bottom = "#020d08"; haze = "#7dff7a"; accent = "#85ff76"; water = "#15584a"; sun = "#e8ff81"; moon = "#caffdf"; star = "#e5ffe1"
  }
  desert = @{
    top = "#251204"; mid = "#71421a"; bottom = "#130904"; haze = "#ffd85f"; accent = "#ffcf55"; water = "#60431e"; sun = "#fff1a8"; moon = "#ffe7b4"; star = "#fff0c9"
  }
  sanctuary = @{
    top = "#070a20"; mid = "#1f1b48"; bottom = "#050711"; haze = "#9a7dff"; accent = "#58f2ff"; water = "#22305f"; sun = "#ffe98a"; moon = "#f0edff"; star = "#ffffff"
  }
  meteor = @{
    top = "#100315"; mid = "#32102e"; bottom = "#07070f"; haze = "#ff7a3d"; accent = "#48f7ff"; water = "#3b1735"; sun = "#ffef8a"; moon = "#e3f0ff"; star = "#fff1df"
  }
}

function Render-Card([string]$id, [string]$kind, [string]$biome, [int]$serial, [bool]$night, [bool]$meteor) {
  $seed = ((Hash-String $id) + ([uint64]$serial * 2654435761)) % 4294967296
  if ($seed -eq 0) { $seed = $serial + 7919 }
  $rng = New-Rng $seed
  $palette = if ($meteor) { $palettes.meteor } elseif ($kind -eq "sanctuary") { $palettes.sanctuary } else { $palettes[$biome] }

  $bitmap = New-Object System.Drawing.Bitmap $W, $H
  $g = [System.Drawing.Graphics]::FromImage($bitmap)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

  try {
    Draw-Background $g $rng $palette $night
    Draw-BackdropTexture $g $rng $biome $kind $meteor
    switch ($kind) {
      "sanctuary" { Draw-SanctuaryScene $g $rng $palette $serial }
      default {
        switch ($biome) {
          "river" { Draw-RiverScene $g $rng $palette $serial $meteor }
          "city" { Draw-CityScene $g $rng $palette $serial $meteor }
          "forest" { Draw-ForestScene $g $rng $palette $serial $meteor }
          "desert" { Draw-DesertScene $g $rng $palette $serial $meteor }
        }
      }
    }

    if ($meteor) {
      Draw-MeteorScene $g $rng $palette $serial
    }

    Draw-ScanTexture $g $rng (Color-Hex $palette.accent)

    $vignette = New-Object System.Drawing.Drawing2D.GraphicsPath
    $vignette.AddEllipse(-($W * 0.22), -($H * 0.28), $W * 1.44, $H * 1.56)
    $pathBrush = New-Object System.Drawing.Drawing2D.PathGradientBrush $vignette
    $pathBrush.CenterColor = [System.Drawing.Color]::FromArgb(0, 0, 0, 0)
    $pathBrush.SurroundColors = @([System.Drawing.Color]::FromArgb(145, 0, 0, 0))
    $g.FillRectangle($pathBrush, 0, 0, $W, $H)
    $pathBrush.Dispose()
    $vignette.Dispose()

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
  $night = ($serial % 3) -eq 0
  Render-Card "region-$serial" "region" $biome $serial $night $false
}

for ($index = 0; $index -lt 45; $index += 1) {
  $night = ($index % 7) -eq 0
  Render-Card "sanctuary-$($index + 1)" "sanctuary" "sanctuary" ($index + 1) $night $false
}

for ($serial = 69; $serial -le 83; $serial += 1) {
  $biome = $biomes[($serial + 1) % $biomes.Count]
  $night = ($serial % 2) -eq 0
  Render-Card "meteor-$serial" "region" $biome $serial $night $true
}

Write-Host "Generated 128 cyberpunk card images in $target"
