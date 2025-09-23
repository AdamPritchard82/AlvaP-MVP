# Door 10 Frontend

A modern React-based consultant dashboard for the Door 10 recruitment platform.

## Features

- **Dashboard**: Overview of key metrics and quick actions
- **Candidates**: Manage candidate database with search and filtering
- **Jobs**: Track job postings and their status
- **Matches**: Review candidate-job matches through the pipeline
- **Clients**: Manage client organizations and contacts

## Tech Stack

- React 18 with TypeScript
- Vite for fast development
- Tailwind CSS for styling
- React Router for navigation
- Lucide React for icons
- React Hook Form for forms
- React Hot Toast for notifications

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

## Backend Integration

The frontend is configured to proxy API requests to the backend running on port 4000. Make sure your backend is running before starting the frontend.

## Environment Variables

Create a `.env` file in the frontend directory if you need to customize the API endpoint:

```
VITE_API_URL=http://localhost:4000
```

## Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.







