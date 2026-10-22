import os
import sys
import subprocess

if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

def create_desktop_shortcut():
    desktop = os.path.join(os.environ.get("USERPROFILE", ""), "Desktop")
    shortcut_path = os.path.join(desktop, "Google Ads Auto Generator.lnk")
    current_dir = os.path.dirname(os.path.abspath(__file__))
    exe_path = os.path.join(current_dir, "dist", "AutoGoogleAds", "AutoGoogleAds.exe")
    launcher_path = os.path.join(current_dir, "launcher.py")

    target = exe_path if os.path.exists(exe_path) else "pythonw.exe"
    args = "" if os.path.exists(exe_path) else f'"{launcher_path}"'
    work_dir = os.path.dirname(exe_path) if os.path.exists(exe_path) else current_dir

    icon_path = os.path.join(current_dir, "icon.ico")
    icon_loc = f"{icon_path},0" if os.path.exists(icon_path) else "shell32.dll,220"

    ps_script = f"""
    $ws = New-Object -ComObject WScript.Shell
    $s = $ws.CreateShortcut('{shortcut_path}')
    $s.TargetPath = '{target}'
    $s.Arguments = '{args}'
    $s.WorkingDirectory = '{work_dir}'
    $s.Description = 'Google Ads Auto Generator'
    $s.IconLocation = '{icon_loc}'
    $s.Save()
    """

    res = subprocess.run(["powershell", "-NoProfile", "-Command", ps_script], capture_output=True, text=True)
    if os.path.exists(shortcut_path):
        print("=" * 60)
        print("DA TAO SHORTCUT THANH CONG TREN MAN HINH CHINH (DESKTOP)!")
        print(f"Vi tri: {shortcut_path}")
        print("=" * 60)
        return True
    else:
        print(f"Loi khi tao shortcut: {res.stderr}")
        return False

if __name__ == "__main__":
    create_desktop_shortcut()
