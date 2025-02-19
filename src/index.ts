#!/usr/bin/env node

import { Command } from "commander";
import inquirer from "inquirer";
import chalk from "chalk";
import ora from "ora";
import { config } from "dotenv";
import { HubSpotClient } from "./hubspot-client";
import { HubDBTable } from "./types";
import axios from "axios";

// Load environment variables from .env file
config();

const program = new Command();

program
  .name("hubdb-copier")
  .description("Copy HubDB tables between HubSpot portals")
  .option("-s, --source-token <token>", "Source HubSpot API token")
  .option("-t, --target-token <token>", "Target HubSpot API token")
  .option("--copy-content", "Copy table content", false)
  .version("1.0.0");

async function getAllTables(client: HubSpotClient): Promise<HubDBTable[]> {
  const tables: HubDBTable[] = [];
  let after: string | undefined;

  do {
    const response = await client.listTables(after);
    console.log("API Response:", JSON.stringify(response, null, 2));

    if (!response.results) {
      console.error("No results array in API response");
      break;
    }

    tables.push(...response.results);
    after = response.paging?.next?.after;

    // If we have tables but no pagination, we're done
    if (response.results.length > 0 && !response.paging) {
      console.log("No pagination information available, but received tables");
      break;
    }
  } while (after);

  return tables;
}

async function copyTable(
  sourceClient: HubSpotClient,
  targetClient: HubSpotClient,
  table: HubDBTable,
  copyContent: boolean
): Promise<void> {
  const spinner = ora(`Copying table: ${table.name}`).start();

  try {
    console.log(chalk.blue("\nSource table details:"));
    console.log(
      JSON.stringify(
        {
          id: table.id,
          name: table.name,
          label: table.label,
          columnCount: table.columnCount,
        },
        null,
        2
      )
    );

    let csvData: string | undefined;
    if (copyContent) {
      // First, export data from source table
      spinner.text = `Exporting data from source table (ID: ${table.id})...`;
      try {
        csvData = await sourceClient.exportTable(table.id);
      } catch (exportError) {
        if (
          axios.isAxiosError(exportError) &&
          exportError.response?.status === 404
        ) {
          // Try using table name if ID fails
          spinner.text = `Retrying export using table name: ${table.name}...`;
          csvData = await sourceClient.exportTable(table.name);
        } else {
          throw exportError;
        }
      }
      spinner.succeed(
        `Successfully exported data from source table: ${table.name}`
      );
    }

    // Check if table exists in target portal
    spinner.text = `Checking if table ${table.name} exists in target portal...`;
    const existingTable = await targetClient.getTableByName(table.name);

    let newTable: HubDBTable | undefined;

    const filteredColumns = table.columns
      .filter((column) => column.type !== "FOREIGN_ID")
      .map((column) => {
        const baseColumn = {
          name: column.name,
          type: column.type,
          label: column.label,
          description: column.description,
        };

        if (column.type === "SELECT" || column.type === "MULTISELECT") {
          return {
            ...baseColumn,
            options: (column.options?.length
              ? column.options
              : [
                  {
                    name: "default",
                    label: "Default Option",
                  },
                ]
            ).map((opt) => ({
              name: opt.name,
              label: opt.label,
            })),
          };
        }

        if (column.type === "FILE") {
          return {
            ...baseColumn,
            fileType: column.fileType || "DOCUMENT", // Ensure fileType is set
          };
        }

        return baseColumn;
      });

    if (existingTable) {
      spinner.succeed(
        `Table ${table.name} already exists in target portal. Adding missing columns...`
      );

      // Build the request for adding columns
      const addColumnsRequest = {
        columns: filteredColumns,
        name: table.name,
        label: table.label,
      };

      // Remove any undefined values
      const cleanAddColumnsRequest = JSON.parse(
        JSON.stringify(addColumnsRequest)
      );

      // Add all columns to existing table
      await targetClient.addColumnsToTable(
        existingTable.id,
        cleanAddColumnsRequest.columns,
        cleanAddColumnsRequest.name,
        cleanAddColumnsRequest.label
      );
      spinner.succeed(`Added columns to table: ${table.name}`);
    } else {
      // Create new table in target portal
      spinner.text = `Creating table ${table.name} in target portal...`;
      const createTableRequest = {
        name: table.name,
        label: table.label,
        columns: filteredColumns,
        allowPublicApiAccess: true,
        useForPages: Boolean(table.useForPages),
        allowChildTables: Boolean(table.allowChildTables),
        enableChildTablePages: Boolean(table.enableChildTablePages),
      };

      // Remove any undefined values
      const cleanRequest = JSON.parse(JSON.stringify(createTableRequest));

      console.log(
        "Creating table with request:",
        JSON.stringify(cleanRequest, null, 2)
      );
      newTable = await targetClient.createTable(cleanRequest);

      console.log(chalk.blue("\nCreated table details:"));
      console.log(
        JSON.stringify(
          {
            id: newTable.id,
            name: newTable.name,
            label: newTable.label,
            columnCount: newTable.columnCount,
          },
          null,
          2
        )
      );
      spinner.succeed(
        `Successfully created table in target portal: ${newTable.name} (ID: ${newTable.id})`
      );
    }

    if (copyContent && csvData) {
      // Import data to target table
      spinner.text = `Importing data to target table (ID: ${
        existingTable ? existingTable.id : newTable?.id
      })...`;

      // Create column mappings based on the CSV header (which matches source column names)
      // The source numbers start at 1 (not 0) according to the docs
      const columnMappings = table.columns
        .filter((column) => column.type !== "FOREIGN_ID")
        .map((column, index) => ({
          source: index + 1, // CSV column index (1-based)
          target: column.name, // Target column name in the new table
        }));

      console.log(chalk.blue("\nImporting to table with details:"), {
        tableId: existingTable ? existingTable.id : newTable!.id,
        tableName: table.name,
        csvDataLength: csvData.length,
        columnMappings,
      });

      try {
        await targetClient.importTable(
          existingTable ? existingTable.id : newTable!.id,
          csvData,
          {
            columnMappings,
            skipRows: 1,
            format: "csv",
            separator: ",",
            encoding: "utf-8",
            resetTable: true,
          }
        );
        spinner.succeed(
          `Successfully imported data to target table: ${table.name}`
        );
      } catch (importError) {
        console.error("Import error details:", importError);
        throw importError;
      }
    }

    // Publish the table
    spinner.text = `Publishing target table...`;
    await targetClient.publishTable(
      existingTable ? existingTable.id : newTable!.id
    );
    spinner.succeed(`Successfully published table: ${table.name}`);
  } catch (error) {
    spinner.fail(`Failed to copy table: ${table.name}`);
    if (axios.isAxiosError(error) && error.response) {
      console.error(
        chalk.red(
          `Error: ${error.response.status} - ${JSON.stringify(
            error.response.data,
            null,
            2
          )}`
        )
      );
    } else {
      console.error(
        chalk.red(
          `Error: ${error instanceof Error ? error.message : String(error)}`
        )
      );
    }
  }
}

async function main() {
  try {
    program.parse();
    const options = program.opts();

    // Get tokens from command line arguments or environment variables
    const sourceToken = options.sourceToken || process.env.HUBSPOT_SOURCE_TOKEN;
    const targetToken = options.targetToken || process.env.HUBSPOT_TARGET_TOKEN;
    const copyContent = options.copyContent;

    if (!sourceToken || !targetToken) {
      console.error(
        chalk.red(
          "Error: Source and target tokens are required. Provide them either through command line arguments or environment variables."
        )
      );
      console.log(
        chalk.yellow(
          "\nUsage:\n" +
            "1. Command line: hubdb-copier -s SOURCE_TOKEN -t TARGET_TOKEN\n" +
            "2. Environment: Set HUBSPOT_SOURCE_TOKEN and HUBSPOT_TARGET_TOKEN in .env file"
        )
      );
      process.exit(1);
    }

    const sourceClient = new HubSpotClient(sourceToken);
    const targetClient = new HubSpotClient(targetToken);

    // Validate API tokens
    const spinner = ora("Validating API tokens...").start();
    try {
      await Promise.all([sourceClient.listTables(), targetClient.listTables()]);
      spinner.succeed("API tokens validated successfully");
    } catch (error) {
      spinner.fail("Invalid API tokens");
      console.error(
        chalk.red(
          `Error: ${error instanceof Error ? error.message : String(error)}`
        )
      );
      process.exit(1);
    }

    // Fetch source tables
    spinner.start("Fetching tables from source portal...");
    const tables = await getAllTables(sourceClient);
    spinner.succeed(`Found ${tables.length} tables in source portal`);

    if (tables.length === 0) {
      console.log(chalk.yellow("No tables found in source portal"));
      return;
    }

    // Let user select tables to copy
    const { selectedTables } = await inquirer.prompt([
      {
        type: "checkbox",
        name: "selectedTables",
        message: "Select tables to copy:",
        choices: tables.map((table) => ({
          name: `${table.label} (${table.name})`,
          value: table,
        })),
      },
    ]);

    if (selectedTables.length === 0) {
      console.log(chalk.yellow("No tables selected for copying"));
      return;
    }

    // Copy selected tables
    console.log(chalk.blue("\nStarting table copy process..."));
    for (const table of selectedTables) {
      await copyTable(sourceClient, targetClient, table, copyContent);
    }

    console.log(chalk.green("\nTable copy process completed!"));
  } catch (error) {
    console.error(
      chalk.red(
        `Error: ${error instanceof Error ? error.message : String(error)}`
      )
    );
    process.exit(1);
  }
}

main();
