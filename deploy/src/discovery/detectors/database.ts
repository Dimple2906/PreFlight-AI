import * as path from 'path';
import { isFile, readTextFile, factHasFile, factReadTextFile } from '../../utils/filesystem';
import { PackageMetadata, hasDependency } from '../../utils/package';
import { DatabaseDetection, DatabaseItem, SupportedDatabase, DatabaseRole, ProjectFacts } from '../../types';

export function detectDatabases(
  projectRoot: string,
  packageMetadata: PackageMetadata,
  projectFacts?: ProjectFacts
): DatabaseDetection {
  const detected: DatabaseItem[] = [];
  const pkg = packageMetadata.raw;

  const checkFile = (relativeFilePath: string): boolean => {
    if (projectFacts) {
      return factHasFile(projectFacts, relativeFilePath);
    }
    return isFile(path.join(projectRoot, relativeFilePath));
  };

  const getFileContent = (relativeFilePath: string): string | null => {
    if (projectFacts) {
      return factReadTextFile(projectFacts, relativeFilePath);
    }
    return readTextFile(path.join(projectRoot, relativeFilePath));
  };

  // 1. Prisma Detection (ORM)
  const prismaEvidence: string[] = [];
  const hasSchema = checkFile('prisma/schema.prisma');
  if (hasSchema) {
    prismaEvidence.push('prisma/schema.prisma schema file found');
  }

  const prismaDep = hasDependency(pkg, 'prisma');
  const prismaClientDep = hasDependency(pkg, '@prisma/client');
  if (prismaDep.found) {
    prismaEvidence.push(`"prisma" dependency (${prismaDep.version}) found in ${prismaDep.section}`);
  }
  if (prismaClientDep.found) {
    prismaEvidence.push(`"@prisma/client" dependency (${prismaClientDep.version}) found in ${prismaClientDep.section}`);
  }

  if (hasSchema && (prismaDep.found || prismaClientDep.found)) {
    detected.push({
      name: 'Prisma',
      role: 'ORM',
      confidence: 'DETECTED',
      evidence: prismaEvidence,
    });
  } else if (hasSchema) {
    detected.push({
      name: 'Prisma',
      role: 'ORM',
      confidence: 'DETECTED',
      evidence: prismaEvidence,
    });
  } else if (prismaDep.found || prismaClientDep.found) {
    detected.push({
      name: 'Prisma',
      role: 'ORM',
      confidence: 'LIKELY',
      evidence: prismaEvidence,
    });
  }

  // Check datasource in prisma schema if available
  let prismaDatasourceProvider: string | null = null;
  if (hasSchema) {
    const schemaContent = getFileContent('prisma/schema.prisma');
    if (schemaContent) {
      const match = schemaContent.match(/provider\s*=\s*["']([^"']+)["']/);
      if (match) {
        prismaDatasourceProvider = match[1].toLowerCase();
      }
    }
  }

  // 2. PostgreSQL Detection (Database engine & driver)
  const pgEvidence: string[] = [];
  const pgDep = hasDependency(pkg, 'pg');
  const pgTypesDep = hasDependency(pkg, '@types/pg');
  const postgresDep = hasDependency(pkg, 'postgres');

  if (pgDep.found) pgEvidence.push(`"pg" dependency (${pgDep.version}) found in ${pgDep.section}`);
  if (postgresDep.found) pgEvidence.push(`"postgres" dependency (${postgresDep.version}) found in ${postgresDep.section}`);
  if (pgTypesDep.found) pgEvidence.push(`"@types/pg" found in ${pgTypesDep.section}`);

  if (prismaDatasourceProvider === 'postgresql' || prismaDatasourceProvider === 'postgres') {
    pgEvidence.push('Prisma schema provider configured as "postgresql"');
  }

  if (pgEvidence.length > 0) {
    const confidence = (pgDep.found || postgresDep.found || prismaDatasourceProvider?.includes('postgres'))
      ? 'DETECTED'
      : 'LIKELY';
    detected.push({
      name: 'PostgreSQL',
      role: 'Database engine',
      confidence,
      evidence: pgEvidence,
    });
  }

  // 3. MySQL Detection
  const mysqlEvidence: string[] = [];
  const mysqlDep = hasDependency(pkg, 'mysql');
  const mysql2Dep = hasDependency(pkg, 'mysql2');
  if (mysqlDep.found) mysqlEvidence.push(`"mysql" driver dependency (${mysqlDep.version}) found in ${mysqlDep.section}`);
  if (mysql2Dep.found) mysqlEvidence.push(`"mysql2" driver dependency (${mysql2Dep.version}) found in ${mysql2Dep.section}`);
  if (prismaDatasourceProvider === 'mysql') {
    mysqlEvidence.push('Prisma schema provider configured as "mysql"');
  }
  if (mysqlEvidence.length > 0) {
    detected.push({
      name: 'MySQL',
      role: 'Database engine',
      confidence: 'DETECTED',
      evidence: mysqlEvidence,
    });
  }

  // 4. MongoDB / Mongoose Detection
  const mongoEvidence: string[] = [];
  const mongooseDep = hasDependency(pkg, 'mongoose');
  const mongoClientDep = hasDependency(pkg, 'mongodb');

  if (mongooseDep.found) {
    mongoEvidence.push(`"mongoose" dependency (${mongooseDep.version}) found in ${mongooseDep.section}`);
  }
  if (mongoClientDep.found) {
    mongoEvidence.push(`"mongodb" client dependency (${mongoClientDep.version}) found in ${mongoClientDep.section}`);
  }
  if (prismaDatasourceProvider === 'mongodb') {
    mongoEvidence.push('Prisma schema provider configured as "mongodb"');
  }

  if (mongooseDep.found) {
    detected.push({
      name: 'Mongoose',
      role: 'ORM',
      confidence: 'DETECTED',
      evidence: mongoEvidence,
    });
    detected.push({
      name: 'MongoDB',
      role: 'Database engine',
      confidence: 'DETECTED',
      evidence: mongoEvidence,
    });
  } else if (mongoEvidence.length > 0) {
    detected.push({
      name: 'MongoDB',
      role: 'Database engine',
      confidence: 'DETECTED',
      evidence: mongoEvidence,
    });
  }

  // 5. SQLite Detection
  const sqliteEvidence: string[] = [];
  const betterSqliteDep = hasDependency(pkg, 'better-sqlite3');
  const sqlite3Dep = hasDependency(pkg, 'sqlite3');
  const sqliteDep = hasDependency(pkg, 'sqlite');

  if (betterSqliteDep.found) sqliteEvidence.push(`"better-sqlite3" dependency found in ${betterSqliteDep.section}`);
  if (sqlite3Dep.found) sqliteEvidence.push(`"sqlite3" dependency found in ${sqlite3Dep.section}`);
  if (sqliteDep.found) sqliteEvidence.push(`"sqlite" dependency found in ${sqliteDep.section}`);
  if (prismaDatasourceProvider === 'sqlite') {
    sqliteEvidence.push('Prisma schema provider configured as "sqlite"');
  }

  if (sqliteEvidence.length > 0) {
    detected.push({
      name: 'SQLite',
      role: 'Database engine',
      confidence: 'DETECTED',
      evidence: sqliteEvidence,
    });
  }

  // 6. Redis Detection (In-memory cache / key-value store, NOT relational engine)
  const redisEvidence: string[] = [];
  const ioredisDep = hasDependency(pkg, 'ioredis');
  const redisDep = hasDependency(pkg, 'redis');
  if (ioredisDep.found) redisEvidence.push(`"ioredis" client dependency (${ioredisDep.version}) found in ${ioredisDep.section}`);
  if (redisDep.found) redisEvidence.push(`"redis" client dependency (${redisDep.version}) found in ${redisDep.section}`);

  if (redisEvidence.length > 0) {
    detected.push({
      name: 'Redis',
      role: 'Cache',
      confidence: 'DETECTED',
      evidence: redisEvidence,
    });
  }

  if (detected.length === 0) {
    return {
      databases: [
        {
          name: 'None',
          role: 'Unknown',
          confidence: 'UNKNOWN',
          evidence: ['No recognized database dependencies or schema configurations found'],
        },
      ],
    };
  }

  return { databases: detected };
}

