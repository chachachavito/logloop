/**
 * logloop — migrate-logs.mjs
 * Reads all .md files from ~/.logloop/logs/ and populates db.json
 *
 * Usage:
 *   node migrate-logs.mjs
 *   node migrate-logs.mjs --dry-run
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

const LOGLOOP_DIR = path.join(os.homedir(), '.logloop');
const LOGS_DIR = path.join(LOGLOOP_DIR, 'logs');
const DB_PATH = path.join(LOGLOOP_DIR, 'db.json');
const DRY_RUN = process.argv.includes('--dry-run');

// ── Parse a single .md file ──────────────────────────────────────────────────

function parseMdFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const fileName = path.basename(filePath, '.md'); // e.g. logloop.chachachavito
    const parts = fileName.split('.');
    const project = parts.slice(0, -1).join('.'); // everything before last dot
    const entries = [];

    // Split by "## [" to get each entry block
    const blocks = content.split(/\n## \[/);

    for (const block of blocks) {
        if (!block.trim() || block.startsWith('# DevLog')) continue;

        const lines = block.trim().split('\n');

        // First line is the timestamp (without the leading "## [" which was split away)
        const timestampRaw = lines[0].replace(']', '').trim();

        const meta = {};
        let noteLines = [];
        let inNote = false;

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];

            if (line.startsWith('id:')) { meta.id = line.replace('id:', '').trim(); continue; }
            if (line.startsWith('commit:')) { meta.commit = line.replace('commit:', '').trim(); continue; }
            if (line.startsWith('branch:')) { meta.branch = line.replace('branch:', '').trim(); continue; }
            if (line.startsWith('type:')) { meta.type = line.replace('type:', '').trim(); continue; }
            if (line.startsWith('mood:')) { meta.mood = line.replace('mood:', '').trim(); inNote = true; continue; }

            if (inNote && line.trim() !== '') {
                noteLines.push(line.trim());
            }
        }

        const note = noteLines.join('\n').trim();
        if (!note) continue; // skip empty entries

        entries.push({
            id: meta.id || (Date.now().toString(36) + Math.random().toString(36).substring(2)),
            createdAt: timestampRaw,
            project,
            type: meta.type || 'thought',
            mood: meta.mood === 'null' ? null : (meta.mood || null),
            commit: meta.commit === 'null' ? null : (meta.commit || null),
            branch: meta.branch === 'null' ? null : (meta.branch || null),
            note,
        });
    }

    return entries;
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
    console.log(`\n🔄 logloop migration${DRY_RUN ? ' [DRY RUN]' : ''}\n`);

    if (!fs.existsSync(LOGS_DIR)) {
        console.error(`❌ Logs directory not found: ${LOGS_DIR}`);
        process.exit(1);
    }

    const mdFiles = fs.readdirSync(LOGS_DIR)
        .filter(f => f.endsWith('.md'))
        .map(f => path.join(LOGS_DIR, f));

    if (mdFiles.length === 0) {
        console.log('⚠️  No .md files found in', LOGS_DIR);
        process.exit(0);
    }

    let allEntries = [];

    for (const file of mdFiles) {
        const entries = parseMdFile(file);
        console.log(`  📄 ${path.basename(file)} → ${entries.length} entries`);
        allEntries = allEntries.concat(entries);
    }

    // Sort by createdAt ascending
    allEntries.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    console.log(`\n✅ Total entries to migrate: ${allEntries.length}`);

    if (DRY_RUN) {
        console.log('\n[DRY RUN] First 3 entries preview:');
        console.log(JSON.stringify(allEntries.slice(0, 3), null, 2));
        return;
    }

    // Read existing db.json
    let db = { logs: [], config: {}, memory: { message: {}, mood: {} } };
    if (fs.existsSync(DB_PATH)) {
        db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    }

    // Merge — avoid duplicates by id
    const existingIds = new Set((db.logs || []).map(l => l.id));
    const newEntries = allEntries.filter(e => !existingIds.has(e.id));

    db.logs = [...(db.logs || []), ...newEntries];

    // Backup before writing
    const backupPath = DB_PATH + '.bak';
    if (fs.existsSync(DB_PATH)) {
        fs.copyFileSync(DB_PATH, backupPath);
        console.log(`\n💾 Backup saved to ${backupPath}`);
    }

    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
    console.log(`✅ db.json updated with ${newEntries.length} new entries.`);
    console.log('\nDone! Run `logloop list` to verify.\n');
}

main();
