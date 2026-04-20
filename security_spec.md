# Firestore Security Specification - Quiz System

## Data Invariants
1. A **Quiz** must have a unique `roomCode`. Only the teacher who created it can modify it.
2. A **Question** must belong to an existing **Quiz**.
3. A **Response** (Participant) is tied to a specific `quizId` and a unique `roll` number within that quiz.
4. Once a **Response** has `status: "Submitted"`, it is largely immutable (terminal state).
5. Identity: If a response is linked to a `studentId` (logged-in user), only that user can update it.

## The "Dirty Dozen" Payloads (Deny Cases)

1. **Identity Spoofing**: Attempt to create a response with `studentId` of another user.
2. **Roll Hi-jacking**: Attempt to update a response document that belongs to a different roll number.
3. **Ghost Fields**: Attempt to add `isGraded: true` or `score: 100` to a response when joining.
4. **Room Code Conflict**: Attempt to update a quiz status to 'active' for a quiz you don't own.
5. **Question Injection**: Attempt to add a question to a quiz session you are a student of.
6. **Time Travel**: Attempt to set `createdAt` to a past date.
7. **Score Poisoning**: Student attempting to update their own `score` field directly.
8. **Pattern Bypass**: Joining a quiz with a roll number that doesn't match the teacher's `allowedRollPatterns`.
9. **Duplicate Join**: Attempt to create a document with an ID that doesn't match the `roll` field.
10. **State Shortcut**: Moving status from `Appearing` to `Submitted` without providing answers.
11. **Admin Escalation**: Student trying to set their own user role to `admin`.
12. **Unverified Email**: Attempting critical writes while `email_verified` is false (for teachers).

## Security Verification Plan
- Verify all `Dirty Dozen` return `PERMISSION_DENIED`.
- Verify `createQuiz` works for authenticated teachers.
- Verify `joinQuiz` works for students (anonymous AND authenticated).
- Verify `updateResponse` works for students only on allowed fields.
- Verify `endQuiz` works only for the author.
