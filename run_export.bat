# ============================================
# Netflix Pro - Entry Point Fix Script
# ============================================

Write-Host "========================================" -ForegroundColor Green
Write-Host "🎬 Netflix Pro - Entry Point Fix" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

# Step 1: Check current files
Write-Host "`n[1] 📁 Checking current files..." -ForegroundColor Yellow

# Check what index files exist
$indexFiles = Get-ChildItem index.* -ErrorAction SilentlyContinue
Write-Host "  Found index files:" -ForegroundColor Cyan
foreach ($file in $indexFiles) {
    Write-Host "    - $($file.Name)" -ForegroundColor Gray
}

# Step 2: Create backup of existing files
Write-Host "`n[2] 💾 Creating backups..." -ForegroundColor Yellow

if (Test-Path index.ts) {
    Copy-Item index.ts index.ts.backup -Force
    Write-Host "  ✅ Backed up index.ts"
}
if (Test-Path App.tsx) {
    Copy-Item App.tsx App.tsx.backup -Force
    Write-Host "  ✅ Backed up App.tsx"
}
if (Test-Path package.json) {
    Copy-Item package.json package.json.backup -Force
    Write-Host "  ✅ Backed up package.json"
}
if (Test-Path app.config.ts) {
    Copy-Item app.config.ts app.config.ts.backup -Force
    Write-Host "  ✅ Backed up app.config.ts"
}

# Step 3: Create the entry point file (index.js)
Write-Host "`n[3] 📝 Creating entry point (index.js)..." -ForegroundColor Yellow

@"
import { registerRootComponent } from 'expo';
import { AppRegistry, Platform } from 'react-native';

console.log('========================================');
console.log('[INDEX] 🚀 Application starting...');
console.log('[INDEX] Platform:', Platform.OS);
console.log('[INDEX] Time:', new Date().toISOString());
console.log('========================================');

// Import App
console.log('[INDEX] 📦 Importing App...');
import App from './App';

console.log('[INDEX] ✅ App imported successfully');
console.log('[INDEX] App type:', typeof App);

// Register the root component
console.log('[INDEX] 📝 Registering root component...');
try {
    registerRootComponent(App);
    console.log('[INDEX] ✅ registerRootComponent completed');
} catch (error) {
    console.error('[INDEX] ❌ registerRootComponent error:', error);
}

// Extra registration for Android
if (Platform.OS === 'android') {
    console.log('[INDEX] 📝 Registering for Android...');
    try {
        AppRegistry.registerComponent('main', () => App);
        console.log('[INDEX] ✅ AppRegistry.registerComponent completed');
    } catch (error) {
        console.error('[INDEX] ❌ AppRegistry.registerComponent error:', error);
    }
}

console.log('[INDEX] ✅ Application ready!');
console.log('========================================');
"@ | Out-File -FilePath index.js -Encoding UTF8

Write-Host "  ✅ Created index.js"

# Step 4: Create a simple App.tsx for testing
Write-Host "`n[4] 📝 Creating test App.tsx..." -ForegroundColor Yellow

@"
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';

console.log('========================================');
console.log('[APP] 📱 App.tsx loaded');
console.log('[APP] React version:', React.version);
console.log('[APP] Platform:', Platform.OS);
console.log('========================================');

export default function App() {
    console.log('[APP] 🎨 App component rendering...');
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        console.log('[APP] 🔄 useEffect running...');
        const timer = setTimeout(() => {
            console.log('[APP] ✅ App is ready!');
            setIsReady(true);
        }, 1000);
        return () => clearTimeout(timer);
    }, []);

    if (!isReady) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="large" color="#E50914" />
                <Text style={styles.loadingText}>Loading Netflix Pro...</Text>
                <Text style={styles.debugText}>Platform: {Platform.OS}</Text>
                <Text style={styles.debugText}>Waiting for initialization...</Text>
            </View>
        );
    }

    console.log('[APP] ✅ Rendering main content...');
    return (
        <View style={styles.container}>
            <StatusBar style="light" />
            <Text style={styles.title}>🔥 Netflix Pro</Text>
            <Text style={styles.subtitle}>App Loaded Successfully! 🎉</Text>
            <Text style={styles.debugText}>Platform: {Platform.OS}</Text>
            <Text style={styles.debugText}>If you see this, the entry point is working!</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#141414',
        padding: 20,
    },
    title: {
        color: '#E50914',
        fontSize: 32,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    subtitle: {
        color: '#FFFFFF',
        fontSize: 20,
        marginBottom: 16,
    },
    loadingText: {
        color: '#FFFFFF',
        fontSize: 18,
        marginTop: 20,
    },
    debugText: {
        color: '#666666',
        fontSize: 14,
        marginTop: 8,
        textAlign: 'center',
    },
});
"@ | Out-File -FilePath App.tsx -Encoding UTF8

Write-Host "  ✅ Created test App.tsx"

# Step 5: Update package.json
Write-Host "`n[5] 📝 Updating package.json..." -ForegroundColor Yellow

$packageJson = Get-Content package.json -Raw | ConvertFrom-Json
$packageJson.main = "index.js"
$packageJson | ConvertTo-Json -Depth 10 | Set-Content package.json
Write-Host "  ✅ Updated package.json main to index.js"

# Step 6: Update app.config.ts
Write-Host "`n[6] 📝 Updating app.config.ts..." -ForegroundColor Yellow

$config = Get-Content app.config.ts -Raw

# Add entryPoint if it doesn't exist
if ($config -notmatch 'entryPoint:') {
    $config = $config -replace 'platforms:\s*\["android"\],', 'platforms: ["android"],`n    entryPoint: "./index.js",'
    Write-Host "  ✅ Added entryPoint to app.config.ts"
} else {
    $config = $config -replace 'entryPoint:\s*"[^"]+"', 'entryPoint: "./index.js"'
    Write-Host "  ✅ Updated entryPoint to index.js"
}
$config | Out-File -FilePath app.config.ts -Encoding UTF8

# Step 7: Clean all caches
Write-Host "`n[7] 🧹 Cleaning caches..." -ForegroundColor Yellow

# Remove .expo folder
if (Test-Path .expo) {
    Remove-Item -Recurse -Force .expo -ErrorAction SilentlyContinue
    Write-Host "  ✅ Removed .expo folder"
}

# Remove node_modules cache
if (Test-Path node_modules\.cache) {
    Remove-Item -Recurse -Force node_modules\.cache -ErrorAction SilentlyContinue
    Write-Host "  ✅ Removed node_modules cache"
}

# Remove dist folder if exists
if (Test-Path dist) {
    Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue
    Write-Host "  ✅ Removed dist folder"
}

# Remove android build if exists
if (Test-Path android\app\build) {
    Remove-Item -Recurse -Force android\app\build -ErrorAction SilentlyContinue
    Write-Host "  ✅ Removed Android build folder"
}

# Step 8: Final check
Write-Host "`n[8] ✅ Final verification..." -ForegroundColor Yellow

Write-Host "  Files:" -ForegroundColor Cyan
Write-Host "    index.js: $(if (Test-Path index.js) { '✅ Exists' } else { '❌ Missing' })" -ForegroundColor $(if (Test-Path index.js) { 'Green' } else { 'Red' })
Write-Host "    App.tsx: $(if (Test-Path App.tsx) { '✅ Exists' } else { '❌ Missing' })" -ForegroundColor $(if (Test-Path App.tsx) { 'Green' } else { 'Red' })

$main = (Get-Content package.json | ConvertFrom-Json).main
Write-Host "  package.json main: $main" -ForegroundColor Cyan

# Check entryPoint in app.config.ts
$config = Get-Content app.config.ts -Raw
if ($config -match 'entryPoint:\s*"([^"]+)"') {
    Write-Host "  app.config.ts entryPoint: $($Matches[1])" -ForegroundColor Cyan
} else {
    Write-Host "  ⚠️ No entryPoint found in app.config.ts" -ForegroundColor Yellow
}

# Step 9: Display summary
Write-Host "`n========================================" -ForegroundColor Green
Write-Host "✅ Fix Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Run: npx expo start -c --verbose" -ForegroundColor White
Write-Host "  2. Look for these logs:" -ForegroundColor White
Write-Host "     - [INDEX] 🚀 Application starting..." -ForegroundColor Gray
Write-Host "     - [INDEX] ✅ App imported successfully" -ForegroundColor Gray
Write-Host "     - [APP] 📱 App.tsx loaded" -ForegroundColor Gray
Write-Host "     - [APP] 🎨 App component rendering..." -ForegroundColor Gray
Write-Host "     - [APP] ✅ App is ready!" -ForegroundColor Gray
Write-Host ""
Write-Host "📁 If it works, restore your original files:" -ForegroundColor Yellow
Write-Host "  Copy-Item index.ts.backup index.ts -Force" -ForegroundColor Gray
Write-Host "  Copy-Item App.tsx.backup App.tsx -Force" -ForegroundColor Gray
Write-Host ""
Write-Host "========================================" -ForegroundColor Green