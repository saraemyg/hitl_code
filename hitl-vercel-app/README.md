# Human-in-the-Loop Validation System

This project is a Human-in-the-Loop validation system for defect detection using a YOLO model. It is built with React and deployed on Vercel.

## Project Structure

```
hitl-vercel-app
├── src
│   ├── pages
│   │   ├── index.js          # Main entry point for the application
│   │   └── api
│   │       └── detect.js     # API route for processing images
│   ├── components
│   │   ├── ImageDisplay.js    # Component for displaying images with bounding boxes
│   │   └── ValidationControls.js # Component for user validation controls
│   └── utils
│       └── yolo.js           # Utility functions for YOLO model interaction
├── public
│   └── test_images           # Directory for test images
├── package.json              # NPM configuration file
├── vercel.json               # Vercel deployment configuration
└── README.md                 # Project documentation
```

## Setup Instructions

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd hitl-vercel-app
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Add test images:**
   Place your test images in the `public/test_images` directory.

4. **Run the application locally:**
   ```bash
   npm run dev
   ```
   Open your browser and navigate to `http://localhost:3000` to view the application.

## Usage Guidelines

- The application displays images from the `public/test_images` directory.
- Users can validate defects by interacting with the provided controls.
- The results of the validation are processed and stored accordingly.

## Deployment

This application is configured for deployment on Vercel. To deploy, simply push your changes to the main branch, and Vercel will automatically build and deploy the application.

## Contributing

Contributions are welcome! Please submit a pull request or open an issue for any enhancements or bug fixes.

## License

This project is licensed under the MIT License.