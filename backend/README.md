# Kacha Employee Management System

A robust backend system for managing employee data, organizational structures, and employment lifecycles.

## Overview

This project is a RESTful API built to handle:
- **Company Structure**: Manage companies, departments, and job titles.
- **Employee Management**: Track personal details, addresses, and contact info.
- **Employment Lifecycle**: Handle contracts, history, promotions, and resignations.
- **Education & Certifications**: Record employee qualifications.
- **Access Control**: Role-based access control (RBAC) for system security.

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Authentication**: JWT & Bcrypt

## Getting Started

1.  **Install Dependencies**
    ```bash
    npm install
    ```

2.  **Database Setup**
    Ensure your PostgreSQL database is running and configured in `.env`.
    ```bash
    npx prisma migrate dev
    ```

3.  **Run Development Server**
    ```bash
    npm run dev
    ```
