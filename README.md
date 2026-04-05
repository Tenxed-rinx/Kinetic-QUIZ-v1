# Kinetic QUIZ v1

A real-time quiz application built with React, Vite, and Firebase.

## Features
- **Real-time Quiz**: Students join via room code and take quizzes in real-time.
- **Dynamic Question Drawing**: Teachers can create a large pool of questions and draw a subset for each student.
- **Accurate Scoring**: Scores are calculated based on the questions actually received by the student.
- **Teacher Dashboard**: Monitor student progress and view detailed reports.
- **AI Integration**: AI-powered quiz generation and assistant.

## Deployment on Vercel

This project is configured for easy deployment on Vercel.

### 1. Environment Variables
You must set the following environment variables in your Vercel project settings:

| Variable | Description |
| --- | --- |
| `VITE_FIREBASE_API_KEY` | Your Firebase API Key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Your Firebase Auth Domain |
| `VITE_FIREBASE_PROJECT_ID` | Your Firebase Project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Your Firebase Storage Bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Your Firebase Messaging Sender ID |
| `VITE_FIREBASE_APP_ID` | Your Firebase App ID |
| `VITE_FIREBASE_MEASUREMENT_ID` | Your Firebase Measurement ID (Optional) |
| `VITE_FIREBASE_DATABASE_ID` | Your Firestore Database ID (e.g., `(default)`) |
| `GEMINI_API_KEY` | Your Google Gemini API Key |

### 2. GitHub Sync
1. Create a new branch on your GitHub repository.
2. Use the **Export to GitHub** tool in AI Studio to push the code to your new branch.
3. Vercel will automatically detect the changes and trigger a deployment.

## Local Development
1. Clone the repository.
2. Create a `.env` file based on `.env.example`.
3. Run `npm install`.
4. Run `npm run dev`.

## Security Rules
The `firestore.rules` file contains the security configuration for your database. 
- **Admin Access**: The `isAdmin` function in the rules is currently configured to grant admin access to `anujyounger66@gmail.com`. You can update this email in the `firestore.rules` file if needed.
- **Data Protection**: Rules are set up to ensure students can only access their own responses while teachers can access all data for their quizzes.
