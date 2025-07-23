# DataCollector Setup Guide - Windows

This guide will help you install all the prerequisites needed to run the DataCollector project on Windows.

## 📋 Prerequisites

To run DataCollector, you need:
1. **Node.js 18+** (includes npm)
2. **Docker Desktop for Windows**
3. **Git** (usually already installed)

## 🚀 Installation Steps

### 1. Install Node.js

**Option A: Official Installer (Recommended)**
1. Go to [nodejs.org](https://nodejs.org/)
2. Download the **LTS version** (Long Term Support) - currently v18.x or v20.x
3. Run the installer with these settings:
   - ✅ Add to PATH (should be checked by default)
   - ✅ Install npm package manager
   - ✅ Install additional tools for Native Modules
4. Restart your PowerShell/Command Prompt
5. Verify installation:
   ```powershell
   node --version
   npm --version
   ```

**Option B: Using Chocolatey (Alternative)**
```powershell
# Install Chocolatey if you don't have it
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Install Node.js
choco install nodejs
```

**Option C: Using Windows Package Manager (winget)**
```powershell
winget install OpenJS.NodeJS
```

### 2. Install Docker Desktop

1. **Download Docker Desktop:**
   - Go to [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/)
   - Download "Docker Desktop for Windows"

2. **System Requirements:**
   - Windows 10 64-bit: Pro, Enterprise, or Education (Build 19041 or higher)
   - OR Windows 11 64-bit
   - WSL 2 feature enabled
   - BIOS-level hardware virtualization support

3. **Installation:**
   - Run the installer
   - Choose "Use WSL 2 instead of Hyper-V" (recommended)
   - Restart your computer when prompted

4. **Setup:**
   - Start Docker Desktop
   - Complete the onboarding tutorial
   - Verify installation:
     ```powershell
     docker --version
     docker-compose --version
     ```

### 3. Enable WSL 2 (Windows Subsystem for Linux)

Docker Desktop works best with WSL 2 enabled:

```powershell
# Run as Administrator
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart

# Restart your computer, then run:
wsl --set-default-version 2
```

### 4. Install Git (if not already installed)

**Check if Git is installed:**
```powershell
git --version
```

**If not installed:**
1. Go to [git-scm.com](https://git-scm.com/download/win)
2. Download and run the installer
3. Use default settings during installation

## 🔧 Configuration

### Configure Git (First time setup)
```powershell
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

### Configure Docker (Resource allocation)
1. Open Docker Desktop
2. Go to Settings → Resources
3. Recommended settings:
   - **Memory:** 4-8 GB (depending on your system)
   - **CPUs:** 2-4 cores
   - **Disk:** 20+ GB free space

## ✅ Verification

After installing everything, verify your setup:

```powershell
# Check Node.js and npm
node --version    # Should show v18.x.x or higher
npm --version     # Should show 9.x.x or higher

# Check Docker
docker --version          # Should show version 20.x or higher
docker-compose --version  # Should show version 2.x or higher

# Check Git
git --version     # Should show version 2.x or higher

# Test Docker
docker run hello-world    # Should download and run successfully
```

## 🚨 Troubleshooting

### Node.js Issues

**"npm/node is not recognized"**
1. Restart your terminal/PowerShell
2. Check if Node.js is in your PATH:
   ```powershell
   $env:PATH -split ';' | Select-String "node"
   ```
3. If not found, reinstall Node.js with "Add to PATH" checked

**Permission errors with npm**
```powershell
# Set npm to use a different directory for global packages
mkdir "$env:APPDATA\npm"
npm config set prefix "$env:APPDATA\npm"
```

### Docker Issues

**"Docker is not running"**
1. Make sure Docker Desktop is started
2. Check Docker Desktop system tray icon
3. Restart Docker Desktop if needed

**"WSL 2 installation is incomplete"**
1. Install the WSL 2 Linux kernel update package
2. Download from: [Microsoft WSL 2 Kernel Update](https://wslstorestorage.blob.core.windows.net/wslblob/wsl_update_x64.msi)

**Docker commands fail**
```powershell
# Reset Docker Desktop
# Go to Docker Desktop → Troubleshoot → Reset to factory defaults
```

### PowerShell Execution Policy Issues

If you encounter execution policy errors:
```powershell
# Run as Administrator
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope LocalMachine
```

## 🔄 Alternative: Development Containers

If you have trouble with local setup, you can use VS Code with Dev Containers:

1. Install [VS Code](https://code.visualstudio.com/)
2. Install the "Dev Containers" extension
3. Open the project in VS Code
4. Click "Reopen in Container" when prompted

## 📞 Getting Help

If you encounter issues:

1. **Check Windows Version:** Ensure you're running a supported Windows version
2. **Run as Administrator:** Some installation steps may require admin privileges
3. **Antivirus Software:** Temporarily disable antivirus during installation
4. **Firewall:** Make sure Docker is allowed through Windows Firewall
5. **Virtual Machine:** If running in a VM, ensure nested virtualization is enabled

## 🎯 Next Steps

Once you have everything installed:

1. **Return to the main directory:**
   ```powershell
   cd "C:\Users\tomasz\Documents\Programowanie lapek\DataCollector"
   ```

2. **Install project dependencies:**
   ```powershell
   npm install
   ```

3. **Start the infrastructure:**
   ```powershell
   npm run setup:infrastructure
   ```

4. **Verify all services are running:**
   ```powershell
   docker-compose -f infrastructure/docker/docker-compose.yml ps
   ```

## 🔗 Useful Links

- [Node.js Documentation](https://nodejs.org/docs/)
- [Docker Desktop Documentation](https://docs.docker.com/desktop/windows/)
- [WSL 2 Documentation](https://docs.microsoft.com/en-us/windows/wsl/install)
- [Git Documentation](https://git-scm.com/doc)

---

**Need help?** Open an issue in the project repository or check the troubleshooting section above. 