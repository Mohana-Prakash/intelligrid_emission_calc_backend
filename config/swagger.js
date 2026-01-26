import swaggerJSDoc from "swagger-jsdoc";

export const swaggerSpec = swaggerJSDoc({
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Emission Calculator API",
      version: "1.0.0",
      description: "DEFRA-based emission calculation APIs",
    },
    servers: [
      {
        url: "http://localhost:4000",
        description: "Local server",
      },
    ],
  },

  // 🔴 THIS IS THE KEY FIX
  apis: [
    "./routes/*.js",
    "./controllers/*.js", // <-- REQUIRED
  ],
});
