::::::::::::::::::::::::::::::::::::::::::::::::::::::
::    Installation script for Deemix                ::
::                                                  ::
::  This script will test if python3 is installed,  ::
::  install it on demand and then download and run  ::
::  Deemix from source.                             ::
::                                                  ::
::  Installer Version 1.1                           ::
::::::::::::::::::::::::::::::::::::::::::::::::::::::
@ECHO OFF
setlocal enabledelayedexpansion

CLS
:: Check for admin permissions. Needed for python requirement installation
:check_Permissions
    echo [93m[Deemix Installer]   Administrative permissions required. Detecting permissions...[0m
    echo %DATE% %TIME% - Checking permissions > "%~dp0log.txt"
    net session >nul 2>&1
    if %errorLevel% == 0 (
        echo [92m[Deemix Installer]   Success: Administrative permissions confirmed.[0m
        echo %DATE% %TIME% - Checking permissions - Admin rights >> "%~dp0log.txt"
    ) else (
        echo [91m[Deemix Installer]   Failed: Please start the install.bat with 'Run as Administrator'[0m
        echo %DATE% %TIME% - Checking permissions - No Admin rights >> "%~dp0log.txt"
        TITLE Please run as admin
        pause
        exit /b
    )

:: Check for Python Installation
:pyTest
CLS
TITLE Deemix Installer
echo [93m[Deemix Installer]   Testing for Python Installation[0m
python --version 2>NUL
if errorlevel 1 (
    echo [91m[Deemix Installer]   Error^: Python not correctly installed[0m
    echo %DATE% %TIME% - Python Installation - Python not correctly installed >> "%~dp0log.txt"
    goto checkBadPathInstalls
)
if errorlevel 0 (
    python --version > "%~dp0pythonversion.txt"
    set /p pyVersion= < "%~dp0pythonversion.txt"
    echo %DATE% %TIME% - Python Installation - Python Version %pyVersion% installed >> "%~dp0log.txt"
    if !pyVersion:~7^,1! EQU 3 (
        goto dlDeemix
    ) else (
        echo [91m[Deemix Installer]   Warning: Old Python Version detected[0m
        goto checkBadPathInstalls
    )
)
:: No Python Installation found
:noPython
set /p answer=[93m[Deemix Installer]   Do you want to download and install Python 3.8? (Y/N)?[0m
if /i "%answer:~,1%" EQU "Y" goto dlPython
if /i "%answer:~,1%" EQU "N" exit /b

:: Download and install Python
:dlPython
echo [93m[Deemix Installer]   Downloading Python[0m
TITLE Deemix Installer - Downloading Python
bitsadmin /transfer PythonDownload /download /priority normal https://www.python.org/ftp/python/3.8.2/python-3.8.2-amd64.exe "%~dp0python-3.8.2-amd64.exe"
echo %DATE% %TIME% - Python Installation - Python Downloaded >> "%~dp0log.txt"
echo [93m[Deemix Installer]   Installing. Please wait a while![0m
TITLE Deemix Installer - Installing Python
"%~dp0python-3.8.2-amd64.exe" /quiet InstallAllUsers=1 PrependPath=1 Include_test=0
echo %DATE% %TIME% - Python Installation - Python installed >> "%~dp0log.txt"
echo [92m[Deemix Installer]   Python 3.8 installed[0m

:: Download and unpack Deemix. Then run the requirements install
:dlDeemix
echo [93m[Deemix Installer]   Downloading Deemix[0m
TITLE Deemix Installer - Downloading Deemix
bitsadmin /transfer DeemixDownload /download /priority normal https://notabug.org/RemixDev/deemix/archive/master.zip "%~dp0master.zip"
echo %DATE% %TIME% - Deemix Installation - Deemix downloaded >> "%~dp0log.txt"
echo [92m[Deemix Installer]   Deemix downloaded, unpacking[0m
TITLE Deemix Installer - Unpacking
echo Set objShell = CreateObject("Shell.Application") > "%~dp0unzip.vbs"
echo Set FilesInZip=objShell.NameSpace("%~dp0master.zip").Items() >> "%~dp0unzip.vbs"
echo objShell.NameSpace("%~dp0").copyHere FilesInZip, 16 >> "%~dp0unzip.vbs"
wscript "%~dp0unzip.vbs"
echo %DATE% %TIME% - Deemix Installation - Deemix unzipped >> "%~dp0log.txt"
echo [92m[Deemix Installer]   Unpacked, installing requirements[0m
TITLE Deemix Installer - Installing python requirements
pip install -r "%~dp0deemix\requirements.txt"
echo [92m[Deemix Installer]   Requirements installed[0m
echo %DATE% %TIME% - Deemix Installation - Requirements installed >> "%~dp0log.txt"

:: Create start.bat
echo [93m[Deemix Installer]   Creating start.bat[0m
echo cd Data\MainData > "%~dp0start_gui.bat"
echo wscript.exe "hide_run.vbs" "prog.bat" >> "%~dp0start_gui.bat"
echo exit >> "%~dp0start_gui.bat"
CLS
TITLE Deemix Installer - Done
echo %DATE% %TIME% - Deemix Installation - All done >> "%~dp0log.txt"
echo [42m[Deemix Installer]   Please start Deemix by executing the start.bat[0m
pause
exit

:checkBadPathInstalls
set pyInstalls=0
:: Find all pyton 3 installs in the default folders
FOR /D %%d IN ("%ProgramFiles%\Python*") DO (
  set /a "pyInstalls+=1"
  set pythonInstall[!pyInstalls!]=%%d
)
FOR /D %%d IN ("%ProgramFiles(x86)%\Python*") DO (
  set /a "pyInstalls+=1"
  set pythonInstall[!pyInstalls!]=%%d
)
FOR /D %%d IN ("%LocalAppData%\Programs\Python*") DO (
  set /a "pyInstalls+=1"
  set pythonInstall[!pyInstalls!]=%%d
)
echo [93m[Deemix Installer]   Found !pyInstalls! installations of Python[0m
set pyOptions=0
FOR /l %%n in (1,1,%pyInstalls%) do (
    set /a "pyOptions+=1"
    echo [93m !pyOptions! : [0m !pythonInstall[%%n]!
)
:: ask the user which folder he wants added to the Path variable
set /p pyAnswer=[93m[Deemix Installer]   Which Install do you want to add to your PATH variable? (type Q to abort)[0m
if /i %pyAnswer% LEQ %pyInstalls% (
    :: Add to path
    setx path "%PATH%;!pythonInstall[%pyAnswer%]!;" /M
    echo [42m[Deemix Installer]   Please restart the install for the new Path to be identified[0m
    pause
    exit
) else (
    if /I "%pyAnswer:~,1%" EQU "Q" (
        echo Aborting
        goto noPython
    ) else (
        echo Please select a valid number
        goto checkBadPathInstalls
    )
)
