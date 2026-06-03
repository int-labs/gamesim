import { Request } from "express";
import mongoose, { SortOrder } from "mongoose";
import { ParsedQs } from "qs";

type PaginationQuery = {
  skip: number;
  limit: number;
  page: number;
  sortOrder?: SortOrder;
  sortField?: string;
  filters: {
    [key: string]: string | string[] | ParsedQs | ParsedQs[] | undefined;
  }; // Filters can be any string or an array of strings
};

interface SearchOptions {
  searchField?: string; // Defaults to 'search'
  fieldsAvailableForSearch: Array<string>; // Must be at least one element
  fullText?: boolean; // Defaults to false
}

// Helper function to handle pagination and filtering with search options
export const getPaginationQuery = (
  req: Request,
  options?: SearchOptions
): PaginationQuery => {
  // Destructure and parse page and limit as strings
  const {
    page = "1",
    limit = "20",
    sortOrder,
    sortField,
    ...queryFilters
  } = req.query;

  // Convert page and limit to numbers, with default values if NaN
  const parsedPage = isNaN(parseInt(page as string, 10))
    ? 1
    : parseInt(page as string, 10);
  const parsedLimit = isNaN(parseInt(limit as string, 10))
    ? 10
    : parseInt(limit as string, 10);

  // Calculate the skip value
  const skip = (parsedPage - 1) * parsedLimit;

  // Convert queryFilters to a format suitable for mongoose
  const mongooseFilters: { [key: string]: any } = Object.entries(
    queryFilters
  ).reduce((acc, [key, value]) => {
    if (Array.isArray(value)) {
      (acc as any)[key] = { $in: value };
    } else if (typeof value === "string") {
      if (mongoose.isValidObjectId(value)) {
        (acc as any)[key] = new mongoose.Types.ObjectId(value);
      } else {
        (acc as any)[key] = value;
      }
    } else {
      (acc as any)[key] = value;
    }
    return acc;
  }, {});

  if (options) {
    const searchQuery = mongooseFilters[
      options.searchField || "search"
    ] as string;

    // Perform search if searchQuery is present and fieldsAvailableForSearch is not empty
    if (searchQuery && options.fieldsAvailableForSearch.length > 0) {
      if (options.fullText) {
        // Full-text search using MongoDB's $text
        mongooseFilters.$text = { $search: searchQuery };
      } else {
        // Case-insensitive search across specified fields
        const regex = new RegExp(searchQuery, "i");
        mongooseFilters.$or = options.fieldsAvailableForSearch.map((field) => ({
          [field]: regex,
        }));
      }
    }

    delete mongooseFilters[options.searchField || "search"];
  }

  // Extract search query from the mongooseFilters

  // Return the result with properly typed values
  // Validate and conform sortOrder to mongoose format
  const validSortOrders = ["asc", "desc", "ascending", "descending", "1", "-1"];
  const validatedSortOrder =
    sortOrder && validSortOrders.includes(sortOrder.toString().toLowerCase())
      ? sortOrder?.toString().toLowerCase()
      : undefined;

  return {
    page: parsedPage,
    skip,
    limit: parsedLimit,
    filters: mongooseFilters,
    sortOrder: validatedSortOrder as SortOrder,
    sortField: sortField ? sortField.toString() : undefined,
  };
};
