# Device-Specific Issues and Solutions

## Overview

This document outlines known device-specific issues, platform differences, and their solutions when developing and running SyntaxisAI locally.

## Platform Differences

### macOS

#### ✅ **Recommended Platform**
macOS is the primary development platform and generally has the fewest issues.

**Advantages:**
- Native Unix environment
- Homebrew package management
- Docker Desktop works well
- PostgreSQL and Redis install easily

**Common Issues:**

1. **Homebrew Permission Issues**
   ```bash
   # Problem: Permission denied when installing packages
   # Solution: Fix Homebrew permissions
   sudo chown -R $(whoami) /usr/local/var/homebrew
   sudo chown -R $(whoami) /usr/local/etc/homebrew
   sudo chown -R $(whoami) /usr/local/share/homebrew
   ```

2. **PostgreSQL Connection Issues**
   ```bash
   # Problem: PostgreSQL not starting after installation
   # Solution: Start PostgreSQL service
   brew services start postgresql@15
   
   # Check if running
   brew services list | grep postgresql
   ```

3. **Node.js Version Conflicts**
   ```bash
   # Problem: Multiple Node.js versions causing issues
   # Solution: Use nvm to manage versions
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
   nvm install 18
   nvm use 18
   nvm alias default 18
   ```

4. **File Path Issues**
   ```bash
   # Problem: Case-sensitive file system issues
   # Solution: Use consistent casing in imports
   # ❌ Wrong
   import { User } from './models/user';
   # ✅ Correct
   import { User } from './models/User';
   ```

### Windows

#### ⚠️ **Requires Additional Setup**
Windows requires more configuration but is fully supported.

**Recommended Approach: WSL2**

1. **Install WSL2**
   ```powershell
   # Run in PowerShell as Administrator
   wsl --install
   wsl --set-default-version 2
   ```

2. **Install Ubuntu in WSL2**
   ```bash
   # From Microsoft Store or command line
   wsl --install -d Ubuntu
   ```

3. **Setup Development Environment in WSL2**
   ```bash
   # Update system
   sudo apt update && sudo apt upgrade -y
   
   # Install Node.js
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # Install PostgreSQL
   sudo apt install postgresql postgresql-contrib
   sudo service postgresql start
   
   # Install Redis
   sudo apt install redis-server
   sudo service redis-server start
   ```

**Common Windows Issues:**

1. **Line Ending Issues**
   ```bash
   # Problem: CRLF vs LF line endings
   # Solution: Configure Git
   git config --global core.autocrlf false
   git config --global core.eol lf
   ```

2. **Path Length Limitations**
   ```bash
   # Problem: Windows path length limit (260 characters)
   # Solution: Enable long paths in Windows 10/11
   # Run in PowerShell as Administrator:
   New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force
   ```

3. **Permission Issues**
   ```bash
   # Problem: Permission denied errors
   # Solution: Run commands in WSL2 or use elevated PowerShell
   # Avoid running npm as administrator
   ```

4. **Docker Desktop Issues**
   ```bash
   # Problem: Docker not working with WSL2
   # Solution: Enable WSL2 integration in Docker Desktop settings
   # Docker Desktop > Settings > Resources > WSL Integration
   ```

5. **Environment Variable Issues**
   ```bash
   # Problem: Environment variables not loading
   # Solution: Use cross-env for cross-platform compatibility
   npm install --save-dev cross-env
   
   # In package.json
   "scripts": {
     "dev": "cross-env NODE_ENV=development nodemon src/index.ts"
   }
   ```

### Linux (Ubuntu/Debian)

#### ✅ **Well Supported**
Linux distributions work well with minimal issues.

**Installation Commands:**
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Install Redis
sudo apt install redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Install build tools
sudo apt install build-essential python3-dev
```

**Common Linux Issues:**

1. **Permission Issues with npm**
   ```bash
   # Problem: Permission denied when installing global packages
   # Solution: Configure npm to use different directory
   mkdir ~/.npm-global
   npm config set prefix '~/.npm-global'
   echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
   source ~/.bashrc
   ```

2. **PostgreSQL Authentication Issues**
   ```bash
   # Problem: Cannot connect to PostgreSQL
   # Solution: Configure authentication
   sudo -u postgres psql
   ALTER USER postgres PASSWORD 'password';
   \q
   
   # Edit pg_hba.conf
   sudo nano /etc/postgresql/15/main/pg_hba.conf
   # Change 'peer' to 'md5' for local connections
   ```

3. **Redis Configuration Issues**
   ```bash
   # Problem: Redis not accessible
   # Solution: Configure Redis
   sudo nano /etc/redis/redis.conf
   # Uncomment: bind 127.0.0.1
   sudo systemctl restart redis-server
   ```

4. **File Watcher Limits**
   ```bash
   # Problem: Too many files to watch error
   # Solution: Increase inotify limits
   echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
   sudo sysctl -p
   ```

## Service Management

### macOS (Homebrew Services)
```bash
# Start services
brew services start postgresql@15
brew services start redis

# Stop services
brew services stop postgresql@15
brew services stop redis

# Restart services
brew services restart postgresql@15
brew services restart redis

# List all services
brew services list
```

### Linux (systemctl)
```bash
# Start services
sudo systemctl start postgresql
sudo systemctl start redis-server

# Stop services
sudo systemctl stop postgresql
sudo systemctl stop redis-server

# Restart services
sudo systemctl restart postgresql
sudo systemctl restart redis-server

# Enable auto-start
sudo systemctl enable postgresql
sudo systemctl enable redis-server

# Check status
sudo systemctl status postgresql
sudo systemctl status redis-server
```

### Windows (WSL2)
```bash
# Start services in WSL2
sudo service postgresql start
sudo service redis-server start

# Stop services
sudo service postgresql stop
sudo service redis-server stop

# Check status
sudo service postgresql status
sudo service redis-server status
```

## Environment Variables

### File Paths
Different platforms handle file paths differently:

```typescript
// ❌ Platform-specific
const filePath = 'C:\\uploads\\file.pdf'; // Windows only
const filePath = '/uploads/file.pdf'; // Unix only

// ✅ Cross-platform
import path from 'path';
const filePath = path.join(process.cwd(), 'uploads', 'file.pdf');
```

### Environment Variable Loading
```bash
# macOS/Linux
export NODE_ENV=development

# Windows (PowerShell)
$env:NODE_ENV="development"

# Windows (Command Prompt)
set NODE_ENV=development

# Cross-platform (using .env file)
# Create .env file with variables
NODE_ENV=development
DATABASE_URL=postgresql://...
```

## Database Connection Strings

### PostgreSQL
```bash
# macOS (Homebrew)
DATABASE_URL=postgresql://postgres:password@localhost:5432/syntaxis_ai

# Linux
DATABASE_URL=postgresql://postgres:password@localhost:5432/syntaxis_ai

# Windows (WSL2)
DATABASE_URL=postgresql://postgres:password@localhost:5432/syntaxis_ai

# Docker
DATABASE_URL=postgresql://postgres:password@db:5432/syntaxis_ai
```

### Redis
```bash
# All platforms (default)
REDIS_URL=redis://localhost:6379

# With authentication
REDIS_URL=redis://username:password@localhost:6379

# Docker
REDIS_URL=redis://redis:6379
```

## Performance Considerations

### macOS
- Generally fastest performance
- SSD recommended for database operations
- 16GB+ RAM recommended for development

### Windows
- WSL2 adds slight overhead
- File system operations slower than native Linux
- Docker Desktop requires significant resources

### Linux
- Best performance for server-like workloads
- Efficient memory usage
- Fast file system operations

## Troubleshooting Commands

### Check System Information
```bash
# Node.js version
node --version

# npm version
npm --version

# PostgreSQL version
psql --version

# Redis version
redis-cli --version

# System information
uname -a  # Linux/macOS
systeminfo  # Windows
```

### Check Service Status
```bash
# PostgreSQL
psql -h localhost -p 5432 -U postgres -c "SELECT version();"

# Redis
redis-cli ping

# Node.js process
ps aux | grep node  # Linux/macOS
tasklist | findstr node  # Windows
```

### Check Ports
```bash
# Check if ports are in use
lsof -i :3001  # Backend port (macOS/Linux)
lsof -i :5173  # Frontend port (macOS/Linux)
netstat -an | findstr :3001  # Windows

# Kill process on port
kill -9 $(lsof -ti:3001)  # macOS/Linux
taskkill /PID <PID> /F  # Windows
```

## IDE-Specific Issues

### VS Code
- Install WSL extension for Windows development
- Configure integrated terminal to use WSL2
- Set up proper TypeScript configuration

### WebStorm/IntelliJ
- Configure Node.js interpreter correctly
- Set up proper run configurations
- Enable WSL2 support on Windows

## Docker Considerations

### macOS
- Docker Desktop works well
- File sharing can be slow
- Use volume mounts carefully

### Windows
- Requires WSL2 backend
- Enable WSL2 integration
- File sharing between Windows and WSL2

### Linux
- Native Docker support
- Best performance
- No additional overhead

## Quick Setup Scripts

### macOS Setup Script
```bash
#!/bin/bash
# install-macos.sh
brew install postgresql@15 redis node
brew services start postgresql@15 redis
createdb syntaxis_ai
npm install
```

### Linux Setup Script
```bash
#!/bin/bash
# install-linux.sh
sudo apt update
sudo apt install -y postgresql postgresql-contrib redis-server nodejs npm
sudo systemctl start postgresql redis-server
sudo -u postgres createdb syntaxis_ai
npm install
```

### Windows Setup Script (PowerShell)
```powershell
# install-windows.ps1
# Run in WSL2 Ubuntu
sudo apt update
sudo apt install -y postgresql postgresql-contrib redis-server
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo service postgresql start
sudo service redis-server start
sudo -u postgres createdb syntaxis_ai
npm install
```

This documentation should be updated as new device-specific issues are discovered during development and testing.
