; Included in the installer; the Microsoft runtime is available without internet.
!include "WinVer.nsh"
!macro customInit
  ${IfNot} ${AtLeastWin10}
    MessageBox MB_ICONSTOP|MB_OK "WAV Scribe requires Windows 10 or Windows 11 (64-bit Intel or AMD)."
    Quit
  ${EndIf}
!macroend

!macro customInstall
  DetailPrint "Installing the included Microsoft speech-engine prerequisites..."
  ExecWait '"$INSTDIR\resources\vc_redist.x64.exe" /install /quiet /norestart' $0
  ${If} $0 == 3010
    SetRebootFlag true
  ${ElseIf} $0 == 1641
    SetRebootFlag true
  ${ElseIf} $0 != 0
  ${AndIf} $0 != 1638
    MessageBox MB_ICONSTOP|MB_OK "Microsoft runtime setup could not finish (code $0). Restart Windows and run this installer again. No internet connection is needed."
    Abort
  ${EndIf}
!macroend
