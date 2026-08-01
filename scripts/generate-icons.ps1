Add-Type -AssemblyName System.Drawing

function New-Icon {
  param([int]$size, [string]$outPath, [bool]$maskable)
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.InterpolationMode = 'HighQualityBicubic'
  $g.Clear([System.Drawing.Color]::Transparent)

  if ($maskable) {
    $pad = 0
  } else {
    $pad = [int]($size * 0.06)
  }
  $rect = New-Object System.Drawing.Rectangle($pad, $pad, ($size - 2 * $pad), ($size - 2 * $pad))
  $radius = [int]($size * 0.22)
  $d = [int]($radius * 2)

  $bgPath = New-Object System.Drawing.Drawing2D.GraphicsPath
  $bgPath.AddArc($rect.X, $rect.Y, $d, $d, 180, 90)
  $bgPath.AddArc(($rect.Right - $d), $rect.Y, $d, $d, 270, 90)
  $bgPath.AddArc(($rect.Right - $d), ($rect.Bottom - $d), $d, $d, 0, 90)
  $bgPath.AddArc($rect.X, ($rect.Bottom - $d), $d, $d, 90, 90)
  $bgPath.CloseFigure()

  $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $rect,
    [System.Drawing.Color]::FromArgb(255, 13, 50, 74),
    [System.Drawing.Color]::FromArgb(255, 4, 18, 28),
    45.0
  )
  $g.FillPath($brush, $bgPath)

  $cx = [single]($size * 0.5)
  $cy = [single]($size * 0.56)
  $r = [single]($size * 0.26)

  $drop = New-Object System.Drawing.Drawing2D.GraphicsPath
  $drop.AddEllipse([single]($cx - $r), [single]($cy - $r), [single]($r * 2), [single]($r * 2))
  $p1 = New-Object System.Drawing.PointF([single]($cx), [single]($cy - $r * 2.4))
  $p2 = New-Object System.Drawing.PointF([single]($cx - $r * 0.75), [single]($cy - $r * 0.35))
  $p3 = New-Object System.Drawing.PointF([single]($cx + $r * 0.75), [single]($cy - $r * 0.35))
  $drop.AddPolygon(@($p1, $p2, $p3))
  $drop.FillMode = 'Winding'

  $rng = New-Object System.Drawing.RectangleF(
    [single]($cx - $r),
    [single]($cy - $r * 2.4),
    [single]($r * 2),
    [single]($r * 3.4)
  )
  $cyan = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $rng,
    [System.Drawing.Color]::FromArgb(255, 103, 232, 249),
    [System.Drawing.Color]::FromArgb(255, 6, 182, 212),
    90.0
  )
  $g.FillPath($cyan, $drop)

  $hl = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(140, 255, 255, 255))
  $g.FillEllipse($hl, [single]($cx - $r * 0.58), [single]($cy - $r * 0.52), [single]($r * 0.42), [single]($r * 0.42))

  $g.Dispose()
  $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Host "OK $outPath"
}

$dir = Join-Path $PSScriptRoot '..\public\icons'
New-Item -ItemType Directory -Force -Path $dir | Out-Null

New-Icon 192 (Join-Path $dir 'icon-192.png') $false
New-Icon 512 (Join-Path $dir 'icon-512.png') $false
New-Icon 512 (Join-Path $dir 'maskable-512.png') $true
New-Icon 180 (Join-Path $dir 'apple-touch-icon.png') $false
