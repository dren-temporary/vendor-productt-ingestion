# Product Ingestion and Description Enhancement Service

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)


## Overview

The **Product Ingestion and Description Enhancement Service** is a NestJS-based application designed to automate the import of product data from CSV files into a MongoDB database. After importing, it enhances product descriptions using OpenAI's GPT-4 to improve marketing appeal. This process is scheduled to run once daily, ensuring that the product database remains up-to-date with enhanced descriptions.

## Features

- **CSV Import**: Efficiently reads and processes large CSV files in chunks.
- **MongoDB Integration**: Stores and manages product, vendor, and manufacturer data.
- **Scheduled Tasks**: Automates daily imports and description enhancements using cron jobs.
- **Description Enhancement**: Utilizes OpenAI's GPT-4 to improve product descriptions.
- **Robust Error Handling**: Ensures reliability and resilience during data processing.
- **Logging**: Comprehensive logging for monitoring and debugging.
- **Chunk**: Data being imported in chunks rather than the whole .txt

## Technology Stack

- **Backend Framework**: [NestJS](https://nestjs.com/)
- **Database**: [MongoDB](https://www.mongodb.com/)
- **CSV Parsing**: [fast-csv](https://github.com/C2FO/fast-csv)
- **OpenAI Integration**: Custom OpenAI API Client
- **Scheduling**: [@nestjs/schedule](https://docs.nestjs.com/techniques/task-scheduling)
- **Other Libraries**:
  - [nanoid](https://github.com/ai/nanoid) for unique ID generation
  - [Config Service](https://docs.nestjs.com/techniques/configuration) for environment management

## Prerequisites

- **Node.js**: Version 14.x or higher
- **npm**: Version 6.x or higher
- **MongoDB**: Access to a MongoDB instance
- **OpenAI API Key**: For description enhancement

## Installation

1. **Clone the Repository**

   ```bash
   git clone repository
   npm install
   npm run start


## Configuration

The **Product Ingestion and Description Enhancement Service** relies on several environment variables to configure its operations. Proper configuration ensures that the application connects correctly to necessary services and operates as expected. This section outlines the required environment variables, their purposes, and how to set them up.

### 1. Environment Variables

Create a `.env` file in the root directory of your project to store all necessary environment variables. This file should **not** be committed to version control to protect sensitive information. Below is a template for the `.env` file with explanations for each variable:

```env
# ------------------------------
# MongoDB Configuration
# ------------------------------
# Connection string for your MongoDB instance.
# Format: mongodb://<username>:<password>@<host>:<port>/<database>?options...
MONGODB_URI=mongodb://localhost:27017/productdb

# ------------------------------
# Vendor CSV File Path
# ------------------------------
# Path to the CSV file containing vendor/product data.
# Can be an absolute path or relative to the project root.
VENDOR_FILE_PATH=./data/vendors.csv

# ------------------------------
# OpenAI Configuration
# ------------------------------
# API key for accessing OpenAI services.
# Obtain this key from your OpenAI account dashboard.
OPENAI_API_KEY=sk-your-openai-api-key

# ------------------------------
# Logging Configuration (Optional)
# ------------------------------
# Defines the logging level for the application.
# Options: trace, debug, info, warn, error, fatal
LOG_LEVEL=debug

# ------------------------------
# Other Configurations (Optional)
# ------------------------------
# Add any additional environment variables your application might need here.