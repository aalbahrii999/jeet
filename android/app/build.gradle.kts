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

    signingConfigs {
        create("update") {
            storeFile = System.getenv("JEET_SIGNING_STORE_FILE")?.let { file(it) }
            storePassword = System.getenv("JEET_SIGNING_STORE_PASSWORD")
            keyAlias = System.getenv("JEET_SIGNING_KEY_ALIAS")
            keyPassword = System.getenv("JEET_SIGNING_KEY_PASSWORD")
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            isDebuggable = false
            signingConfig = signingConfigs.getByName("update")
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
    inputs.property("initialBackupPath", System.getenv("JEET_INITIAL_BACKUP_FILE") ?: "")
    System.getenv("JEET_INITIAL_BACKUP_FILE")?.let { inputs.file(file(it)) }
    outputs.dir(layout.projectDirectory.dir("src/main/assets/www"))
}

tasks.named("preBuild").configure {
    dependsOn(buildWebAssets)
}

val requireUpdateKey by tasks.registering {
    doLast {
        val required = listOf("JEET_SIGNING_STORE_FILE", "JEET_SIGNING_STORE_PASSWORD", "JEET_SIGNING_KEY_ALIAS", "JEET_SIGNING_KEY_PASSWORD")
        check(required.all { !System.getenv(it).isNullOrBlank() }) {
            "Release signing requires the persistent Jeet release key. Debug signing is never used."
        }
        check(file(System.getenv("JEET_SIGNING_STORE_FILE")).isFile) { "Release signing keystore not found." }
    }
}

tasks.matching { it.name == "preReleaseBuild" }.configureEach {
    dependsOn(requireUpdateKey)
}

