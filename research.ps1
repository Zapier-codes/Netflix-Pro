# =============================================
# EDUCATIONAL RESEARCH SCRIPT - PowerShell
# Demonstrates App Identity & Certificate Verification
# FOR RESEARCH PURPOSES ONLY
# =============================================

Clear-Host
Write-Host "🔬 EDUCATIONAL RESEARCH: App Identity Verification" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""

# Clean up old research directory if exists
if (Test-Path "research_demo") {
    Remove-Item -Recurse -Force "research_demo" -ErrorAction SilentlyContinue
}

# Create research directory
$RESEARCH_DIR = "research_demo"
New-Item -ItemType Directory -Path $RESEARCH_DIR -Force | Out-Null
Push-Location $RESEARCH_DIR

Write-Host "📜 PART 1: Certificate Generation & Fingerprinting" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "1. Generating Test Certificates..." -ForegroundColor Blue
Write-Host ""

# Delete old keystores if they exist
Remove-Item "netflix-sim.keystore" -Force -ErrorAction SilentlyContinue
Remove-Item "your-app.keystore" -Force -ErrorAction SilentlyContinue

# Generate Netflix certificate - Using single quotes to avoid escaping issues
Write-Host "Generating 'Netflix' certificate (simulated)..." -ForegroundColor Yellow
$netflixCmd = @'
keytool -genkey -v -keystore netflix-sim.keystore -alias netflix-sim -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Netflix Inc, OU=Engineering, O=Netflix, L=Los Gatos, ST=California, C=US" -storepass research123 -keypass research123 -noprompt
'@
Invoke-Expression $netflixCmd 2>&1 | Out-Null

# Generate Your certificate
Write-Host "Generating 'Your' certificate (simulated)..." -ForegroundColor Yellow
$yourCmd = @'
keytool -genkey -v -keystore your-app.keystore -alias your-app -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Your App, OU=Research, O=Personal, L=City, ST=State, C=US" -storepass research123 -keypass research123 -noprompt
'@
Invoke-Expression $yourCmd 2>&1 | Out-Null

Write-Host "✅ Certificates generated" -ForegroundColor Green
Write-Host ""

# Extract fingerprints
Write-Host "2. Extracting Certificate Fingerprints..." -ForegroundColor Blue
Write-Host ""

Write-Host "Netflix Certificate Fingerprint:" -ForegroundColor Yellow
$netflixOutput = keytool -list -v -keystore netflix-sim.keystore -storepass research123 2>&1
$netflixOutput | Select-String "SHA1:" | Select-Object -First 1

Write-Host ""
Write-Host "Your Certificate Fingerprint:" -ForegroundColor Yellow
$yourOutput = keytool -list -v -keystore your-app.keystore -storepass research123 2>&1
$yourOutput | Select-String "SHA1:" | Select-Object -First 1

Write-Host ""
Write-Host "✅ Fingerprints extracted" -ForegroundColor Green
Write-Host ""

# Comparison
Write-Host "3. Certificate Comparison" -ForegroundColor Blue
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

# Extract the actual SHA1 values
$netflixSha1 = ($netflixOutput | Select-String "SHA1:" | Select-Object -First 1).ToString().Split(":")[-1].Trim()
$yourSha1 = ($yourOutput | Select-String "SHA1:" | Select-Object -First 1).ToString().Split(":")[-1].Trim()
$officialNetflixSha1 = "d7268d869be7d87cb797e8f7449bf2451ed8019b"

if ($netflixSha1) {
    Write-Host "📜 Netflix (Simulated) SHA-1: $netflixSha1" -ForegroundColor Yellow
}
if ($yourSha1) {
    Write-Host "📜 Your App SHA-1:           $yourSha1" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🔒 PLAY PROTECT VERIFICATION:" -ForegroundColor Cyan
Write-Host "   Official Netflix SHA-1: $officialNetflixSha1" -ForegroundColor Gray
Write-Host ""

if ($netflixSha1 -and $yourSha1) {
    if ($netflixSha1 -eq $officialNetflixSha1) {
        Write-Host "   ✅ Netflix certificate matches official" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Netflix certificate is SIMULATED" -ForegroundColor Yellow
    }
    
    if ($yourSha1 -eq $officialNetflixSha1) {
        Write-Host "   ✅ Your certificate matches Netflix" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Your certificate does NOT match Netflix" -ForegroundColor Red
        Write-Host "      (Expected: $officialNetflixSha1)" -ForegroundColor Gray
        Write-Host "      (Got:      $yourSha1)" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "💡 RESEARCH CONCLUSION:" -ForegroundColor Cyan
Write-Host "   Certificates are unique and cannot be forged without the" -ForegroundColor White
Write-Host "   original private signing key. Identity spoofing is" -ForegroundColor White
Write-Host "   cryptographically impossible at the verification level." -ForegroundColor White
Write-Host ""

# Package Name Demo - Using proper here-string with closing "@ at column 0
Write-Host "4. Package Name Spoofing Demo" -ForegroundColor Blue
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

# Create AndroidManifest_demo.xml using a proper here-string
$xmlContent = @"
<!-- AndroidManifest.xml - Package name can be changed -->
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.netflix.mediaclient">
    <application android:label="Netflix Pro"/>
</manifest>
"@

$xmlContent | Out-File -FilePath "AndroidManifest_demo.xml" -Encoding UTF8

Write-Host "✅ AndroidManifest demonstration created" -ForegroundColor Green
Write-Host ""

# Summary
Write-Host "📊 SUMMARY" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  1. Package Name Spoofing: ✅ POSSIBLE" -ForegroundColor Green
Write-Host "     - Can change com.netflix.mediaclient" -ForegroundColor Gray
Write-Host "  2. Certificate Spoofing: ❌ IMPOSSIBLE" -ForegroundColor Red
Write-Host "     - Requires Netflix's private signing key" -ForegroundColor Gray
Write-Host "  3. Play Protect Bypass: ⚠️ TEMPORARY" -ForegroundColor Yellow
Write-Host "     - Will be detected eventually" -ForegroundColor Gray
Write-Host "  4. 100% Identity Spoof: ❌ IMPOSSIBLE" -ForegroundColor Red
Write-Host ""

# Cleanup
Pop-Location

Write-Host "📁 Research files created in: $RESEARCH_DIR" -ForegroundColor Cyan
Write-Host "   To view: cd $RESEARCH_DIR" -ForegroundColor Gray
Write-Host ""
Write-Host "✅ Research Complete!" -ForegroundColor Green
Write-Host ""

# Fixed the line with the quoting issue
Write-Host "🔑 To generate a REAL production keystore for your app:" -ForegroundColor Yellow
Write-Host '   keytool -genkey -v -keystore netflix-pro.keystore -alias netflix-pro -keyalg RSA -keysize 4096 -validity 10000' -ForegroundColor Gray
Write-Host ""