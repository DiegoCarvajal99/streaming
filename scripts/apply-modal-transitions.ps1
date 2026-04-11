$files = @(
  'c:\Users\Admin\OneDrive - Corporacion Universitaria Remington\streaming-admin\streaming\src\pages\Sales.jsx',
  'c:\Users\Admin\OneDrive - Corporacion Universitaria Remington\streaming-admin\streaming\src\pages\Distributors.jsx',
  'c:\Users\Admin\OneDrive - Corporacion Universitaria Remington\streaming-admin\streaming\src\pages\Users.jsx',
  'c:\Users\Admin\OneDrive - Corporacion Universitaria Remington\streaming-admin\streaming\src\pages\Clients.jsx',
  'c:\Users\Admin\OneDrive - Corporacion Universitaria Remington\streaming-admin\streaming\src\pages\Platforms.jsx',
  'c:\Users\Admin\OneDrive - Corporacion Universitaria Remington\streaming-admin\streaming\src\pages\Dashboard.jsx',
  'c:\Users\Admin\OneDrive - Corporacion Universitaria Remington\streaming-admin\streaming\src\App.jsx'
)

foreach ($f in $files) {
  if (!(Test-Path $f)) { continue }
  $c = [System.IO.File]::ReadAllText($f, [System.Text.Encoding]::UTF8)
  $orig = $c
  $c = $c.Replace('animate-in zoom-in overflow-hidden', 'modal-transition overflow-hidden')
  $c = $c.Replace('animate-in zoom-in-95 duration-300', 'modal-transition')
  $c = $c.Replace('animate-in zoom-in h-[90vh]', 'modal-transition h-[90vh]')
  $c = $c.Replace('animate-in zoom-in', 'modal-transition')
  if ($c -ne $orig) {
    [System.IO.File]::WriteAllText($f, $c, [System.Text.Encoding]::UTF8)
    Write-Host "Updated: $(Split-Path $f -Leaf)"
  } else {
    Write-Host "No changes: $(Split-Path $f -Leaf)"
  }
}
Write-Host "Done"
