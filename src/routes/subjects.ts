import express from "express";
import { subjects, departments } from "../db/schema/index.js";
import { and, eq, ilike, or } from "drizzle-orm/sql/expressions/conditions";
import { db } from "../db/index.js";
import { sql } from "drizzle-orm/sql/sql";
import { getTableColumns, desc } from "drizzle-orm";

const router = express.Router();

//get all subjects with optional search, filtering and pagination
router.get("/", async (req, res) => {
  try {
    const { search, department, page = 1, limit = 10 } = req.query;

    const parsedPage = Number(page);
    const parsedLimit = Number(limit);
    const currentPage =
      Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const limitPerPage =
      Number.isInteger(parsedLimit) && parsedLimit > 0
        ? Math.min(parsedLimit, 100)
        : 10;

    const offset = (currentPage - 1) * limitPerPage;

    const filterConditions = [];

    if (search) {
      filterConditions.push(
        or(
          ilike(subjects.name, `%${search}%`),
          ilike(subjects.code, `%${search}%`),
          ilike(subjects.description, `%${search}%`),
        ),
      );
    }

    if (department) {
      filterConditions.push(ilike(departments.name, `%${department}%`));
    }

    const whereClause =
      filterConditions.length > 0 ? and(...filterConditions) : undefined;

    const countResult = await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(subjects)
      .leftJoin(departments, eq(subjects.departmentId, departments.id))
      .where(whereClause);

    const totalCount = countResult[0]?.count || 0;

    const subjectList = await db.select({
      ...getTableColumns(subjects),
      department: { ...getTableColumns(departments) },
    }).from(subjects).leftJoin(departments, eq(subjects.departmentId, departments.id))
    .where(whereClause)
    .orderBy(desc(subjects.createdAt), desc(subjects.id))
    .limit(limitPerPage)
    .offset(offset);
    ;

    res.status(200).json({
      data: subjectList,
      pagination: {
        page: currentPage,
        limit: limitPerPage,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitPerPage),
      },
    });
  } catch (error) {
    console.error("Error fetching subjects:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;