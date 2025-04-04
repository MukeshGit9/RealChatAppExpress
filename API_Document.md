**1. Register API**

End Point : /api/auth/register

Description : Register a nea user

**Request JSON:**

{
  "username": "john_doe",
  "email": "john.doe@example.com",
  "password": "SecurePassword123",
  "confirmPassword": "SecurePassword123"
}

**Response JSON:**

{
  "status": "success",
  "message": "User registered successfully.",
  "user": {
    "id": 1,
    "username": "john_doe",
    "email": "john.doe@example.com"
  }
}

**Error Response:**

{
  "status": "error",
  "message": "Password and confirm password do not match."
}

---



**1. Login API**

End Point : /api/auth/login

Description : authenticate an existing user and log them in.

**Request JSON:**

{
  "email": "john.doe@example.com",
  "password": "SecurePassword123"
}

**Response JSON:**

{
  "status": "success",
  "message": "Login successful.",
  "token": "jwt_token_here",
  "user": {
    "id": 1,
    "username": "john_doe",
    "email": "john.doe@example.com"
  }
}

**Error Response:**

{
  "status": "error",
  "message": "Invalid credentials."
}

---


**1. Profile API**

End Point : /api/userprofile

Description : fetches the profile information of the currently authenticated user.

**Request JSON:**

Authorization: Bearer jwt_token_here

**Response JSON:**

{
  "status": "success",
  "user": {
    "id": 1,
    "username": "john_doe",
    "email": "john.doe@example.com",
    "fullName": "John Doe",
    "dateOfBirth": "1990-05-15",
    "profilePicture": "https://example.com/images/john_doe.jpg"
  }
}

------------------------------------------------------------------------------
