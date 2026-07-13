export async function up(knex) {
  await knex.schema.createTable('sys_user', (table) => {
    table.uuid('id').primary();
    table.uuid('tenant_id').notNullable();
    
    table.string('full_name', 200).notNullable();
    table.string('email', 200).notNullable();
    table.string('password_hash', 255).nullable();
    table.string('google_id', 200).nullable();
    table.string('phone', 50).nullable();
    table.text('avatar_url').nullable();
    table.string('department', 150).nullable();
    table.string('job_title', 150).nullable();
    
    // Preferences
    table.string('language', 10).defaultTo('en');
    table.string('timezone', 50).defaultTo('UTC');
    table.string('date_format', 20).defaultTo('yyyy-mm-dd');
    
    // Auth security
    table.integer('failed_login_count').defaultTo(0);
    table.datetime('locked_until').nullable();
    table.datetime('last_login_at').nullable();
    table.string('last_login_ip', 45).nullable();
    
    table.string('invitation_token', 100).nullable();
    table.datetime('invitation_expires_at').nullable();
    table.boolean('is_system_user').defaultTo(false);
    
    // Standard status and tracking
    table.string('status', 20).defaultTo('Active');
    table.uuid('created_by').nullable();
    table.uuid('updated_by').nullable();
    table.datetime('created_at').defaultTo(knex.fn.now());
    table.datetime('updated_at').defaultTo(knex.fn.now());
    
    // Indexes
    table.unique(['tenant_id', 'email']);
    table.index(['tenant_id', 'google_id']);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('sys_user');
}
