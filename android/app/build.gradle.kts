plugins {
    id("com.android.application")
}

android {
    namespace = "app.jeet"
    compileSdk = 35

    defaultConfig {
        applicationId = "app.jeet"
        minSdk = 26
        targetSdk = 35
        versionCode = 5
        versionName = "2.0.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.core:core:1.15.0")
    implementation("androidx.webkit:webkit:1.12.1")
}

configurations.configureEach {
    exclude(group = "org.jetbrains.kotlin", module = "kotlin-stdlib-jdk7")
    exclude(group = "org.jetbrains.kotlin", module = "kotlin-stdlib-jdk8")
}

val buildWebAssets by tasks.registering(Exec::class) {
    workingDir(rootProject.projectDir.parentFile)
    commandLine("npm", "run", "build:apk")
    inputs.dir(rootProject.projectDir.resolve("../src"))
    inputs.dir(rootProject.projectDir.resolve("../public/machines"))
    inputs.file(rootProject.projectDir.resolve("../package-lock.json"))
    inputs.file(rootProject.projectDir.resolve("../scripts/build-apk.mjs"))
    outputs.dir(layout.projectDirectory.dir("src/main/assets/www"))
}

tasks.named("preBuild").configure {
    dependsOn(buildWebAssets)
}

