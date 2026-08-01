// ─────────────────────────────────────────────────────────────────────────────
//  Jenkinsfile  —  terra-api-fe CI
//
//  WHY does this file exist at the repo root?
//  Multibranch Pipeline jobs read this file from each discovered branch's own
//  tip commit — no Jenkinsfile on a branch means Jenkins can't build it at all
//  (see "Jenkinsfile not found" / "Does not meet criteria" in the Scan
//  Repository Log for any branch missing this file).
//
//  WHY no deploy stage?
//  terra-api-fe has no independent deploy target — same-origin deploy
//  (terra-api-adr-009) means this repo's build/ output gets copied into
//  terra-api's own jar and shipped as part of THAT repo's deploy, not this
//  one. This pipeline exists purely for fast, independent CI feedback on
//  every push — actual shipping happens via terra-api's own Jenkinsfile
//  (see its "Checkout Frontend" / "Copy Frontend Build" stages).
// ─────────────────────────────────────────────────────────────────────────────

pipeline {
    agent any

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        // WHY 'npm ci' not 'npm install'?
        // Reproducible, lockfile-exact — fails loudly on a lockfile/package.json
        // drift instead of silently re-resolving (see DEV_LOG.md for the
        // typescript/tailwindcss peer-conflict incidents this would have caught
        // earlier than a live build failure).
        stage('Build') {
            steps {
                sh 'npm ci'
                sh 'npm run build'
            }
        }

        // WHY '--watchAll=false'?
        // react-scripts test defaults to interactive watch mode, which would
        // hang the pipeline forever waiting for keyboard input.
        stage('Test') {
            steps {
                sh 'npm test -- --watchAll=false'
            }
        }
    }

    post {
        success {
            echo "Build #${BUILD_NUMBER} passed — all stages green."
        }
        failure {
            echo "Build #${BUILD_NUMBER} failed — check the stage logs above."
        }
    }
}