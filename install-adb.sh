#!/bin/bash

# Define variables
PLATFORM_TOOLS_URL=""
INSTALL_DIR="/usr/local/bin"

# Detect Operating System
OS="$(uname)"
if [ "$OS" == "Linux" ]; then
    PLATFORM_TOOLS_URL="https://dl.google.com/android/repository/platform-tools-latest-linux.zip"
elif [ "$OS" == "Darwin" ]; then
    PLATFORM_TOOLS_URL="https://dl.google.com/android/repository/platform-tools-latest-darwin.zip"
else
    echo "Unsupported OS: $OS"
    exit 1
fi

echo "--- Starting ADB Installation for $OS ---"

# Create a temporary directory
TEMP_DIR=$(mktemp -d)
cd "$TEMP_DIR" || exit

# Download the latest platform tools
echo "Downloading latest Platform Tools..."
curl -L -o platform-tools.zip "$PLATFORM_TOOLS_URL"

# Unzip the package
echo "Extracting..."
unzip -q platform-tools.zip

# Move adb and fastboot to /usr/local/bin
# Using sudo because /usr/local/bin is a protected system directory
echo "Moving binaries to $INSTALL_DIR (requires sudo)..."
sudo mv platform-tools/adb "$INSTALL_DIR/"
sudo mv platform-tools/fastboot "$INSTALL_DIR/"

# Clean up
cd ~
rm -rf "$TEMP_DIR"

# Set permissions
sudo chmod +x "$INSTALL_DIR/adb"
sudo chmod +x "$INSTALL_DIR/fastboot"

echo "--- Installation Complete ---"
echo "Verification:"
adb version
