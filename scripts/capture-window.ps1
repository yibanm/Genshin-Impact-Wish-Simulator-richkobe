# Capture the genshin-wish-roll (Tauri) window content.
#
# MUST STAY ASCII-ONLY: PowerShell 5.1 reads UTF-8 .ps1 files WITHOUT BOM as ANSI,
# so any Chinese character here becomes mojibake bytes fed to the C# compiler
# (Add-Type) and produces bogus syntax errors. Inline -Command worked before only
# because command-line strings arrive as UTF-16.
#
# Why not CopyFromScreen: it captures screen coordinates, so a window covering the
# target shows up instead (measured: captured the Douyin client once).
# PrintWindow grabs the window's own bitmap and works even when obscured;
# flags=2 (PW_RENDERFULLCONTENT) handles hardware-accelerated WebView2 content.
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class WinCap {
    [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr hwnd, IntPtr hdcBlt, uint nFlags);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hwnd, out RECT r);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hwnd);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc cb, IntPtr lParam);
    [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hwnd, StringBuilder sb, int max);
    public delegate bool EnumWindowsProc(IntPtr hwnd, IntPtr lParam);
    [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }

    // Enumerate every visible window of the process and return the largest one.
    // Get-Process MainWindowHandle is unreliable here: Tauri/WebView2 create
    // several windows (including hidden/tray ones) and PowerShell reported a
    // 15x15 hidden window in practice.
    public static IntPtr FindMainWindow(uint targetPid) {
        IntPtr best = IntPtr.Zero;
        long bestArea = 0;
        EnumWindows(delegate(IntPtr hwnd, IntPtr lp) {
            uint pid;
            GetWindowThreadProcessId(hwnd, out pid);
            if (pid != targetPid || !IsWindowVisible(hwnd)) return true;
            RECT r;
            GetWindowRect(hwnd, out r);
            long area = (long)(r.Right - r.Left) * (r.Bottom - r.Top);
            if (area > bestArea) { bestArea = area; best = hwnd; }
            return true;
        }, IntPtr.Zero);
        return best;
    }

    public static string Title(IntPtr hwnd) {
        StringBuilder sb = new StringBuilder(256);
        GetWindowText(hwnd, sb, 256);
        return sb.ToString();
    }
}
"@

$p = Get-Process -Name 'genshin-wish-roll' -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $p) { Write-Host 'NO_PROCESS'; exit 1 }
$hwnd = [WinCap]::FindMainWindow([uint32]$p.Id)
if ($hwnd -eq [IntPtr]::Zero) { Write-Host 'NO_VISIBLE_WINDOW'; exit 1 }
Write-Host ("window title=[{0}]" -f [WinCap]::Title($hwnd))

$r = New-Object WinCap+RECT
[WinCap]::GetWindowRect($hwnd, [ref]$r) | Out-Null
$w = $r.Right - $r.Left
$hgt = $r.Bottom - $r.Top
Write-Host ("window size {0}x{1}" -f $w, $hgt)
if ($w -lt 50 -or $hgt -lt 50) { Write-Host 'WINDOW_TOO_SMALL'; exit 1 }

$bmp = New-Object System.Drawing.Bitmap $w, $hgt
$g = [System.Drawing.Graphics]::FromImage($bmp)
$hdc = $g.GetHdc()
$ok = [WinCap]::PrintWindow($hwnd, $hdc, 2)
$g.ReleaseHdc($hdc)
$g.Dispose()
# Output path is built at runtime from $PSScriptRoot (correct Unicode, derived
# from the real path) instead of a literal: a Chinese literal in this file would
# be read as ANSI mojibake by PowerShell 5.1 and save to a wrong location.
$out = Join-Path (Split-Path $PSScriptRoot -Parent) '.tauri-runtime.png'
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Host ("PrintWindow ok={0} saved={1}" -f $ok, $out)
