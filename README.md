# HubDB Copier

A command-line tool to copy HubDB tables between HubSpot portals.

## Features

- Copy multiple HubDB tables between HubSpot portals
- Interactive table selection interface
- Preserves table schema and data
- Progress indicators for long operations
- Error handling and validation
- Support for environment variables

## Installation

```bash
npm install -g hubdb-copier
```

## Usage

You can provide HubSpot API tokens either through command-line arguments or environment variables.

### Using Command Line Arguments

```bash
hubdb-copier -s SOURCE_TOKEN -t TARGET_TOKEN
```

### Using Environment Variables

1. Create a `.env` file in your working directory:

```bash
HUBSPOT_SOURCE_TOKEN=pat-na1-xxxx
HUBSPOT_TARGET_TOKEN=pat-na1-yyyy
```

2. Run the command without arguments:

```bash
hubdb-copier
```

### Options

- `-s, --source-token <token>`: Source HubSpot API token (optional if set in .env)
- `-t, --target-token <token>`: Target HubSpot API token (optional if set in .env)
- `-V, --version`: Output the version number
- `-h, --help`: Display help information
- `--copy-content`: Copy table content along with schema
- `--update-existing`: Update existing tables in target portal

### Example

Using command line:

```bash
hubdb-copier -s pat-na1-xxxx -t pat-na1-yyyy
```

Using environment variables:

```bash
# Set up environment variables
cp .env.example .env
# Edit .env with your tokens
vim .env
# Run the tool
hubdb-copier
```

## How it works

1. Validates both source and target API tokens
2. Fetches all tables from the source portal
3. Displays an interactive menu to select tables for copying
4. For each selected table:
   - Creates a new table with identical schema in the target portal
   - Exports data from the source table
   - Imports data into the target table
   - Publishes the table in the target portal

## Requirements

- Node.js 14 or higher
- Valid HubSpot API tokens for both source and target portals

## Development

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your tokens
   ```
4. Build the project:
   ```bash
   npm run build
   ```
5. Run in development mode:

   ```bash
   npm run dev
   ```

   To pass CLI options in development mode, add them after a double dash (--). For example, to include the option of `--update-existing`:

   ```
   npm run dev -- --update-existing
   ```

## License

MIT
