#!/usr/bin/env node

const PROCESS = require('process');
const readline = require('readline');
const { Client } = require('pg');

// handling anything about the program specific to the cli
// processes the arguments and determines what action needs to be performed
function logAndExit(err) {
  console.log(err);
  console.log('LOG AND EXIT FUNCTION running');
  process.exit(1);
}

class ExpenseData {
  constructor() {
    this.client = new Client({ database: 'project_1' });
  }

  async setup_schema() {
    let tableExistsQuery = `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'expenses'`;

    let res = await this.client.query(tableExistsQuery).catch(err => logAndExit(err));

    if (res.rows[0].count === '0') {
      let setupQuery = `CREATE TABLE expenses (
        id integer NOT NULL,
        amount numeric(6,2) NOT NULL,
        memo text NOT NULL,
        created_on date DEFAULT now() NOT NULL,
        CONSTRAINT expenses_amount_check CHECK (((amount >= 0.01) AND (amount <= 9999.99)))
      )`;

      await this.client.query(setupQuery).catch(err => logAndExit(err));
    }
  }

  displayHelp() {
    console.log(ExpenseData.HELP);
  }

  displayRows(res) {
    res.rows.forEach(tuple => {
      let columns = [
        `${tuple.id}`.padStart(3),
        tuple.created_on.toDateString().padStart(10),
        tuple.amount.padStart(11),
        tuple.memo
      ];

      console.log(columns.join(' | '));
    });
  }
  
  displayNumberOfExpenses(numberOfRows) {
    switch (numberOfRows) {
      case 0:
        console.log('There are no expenses.');
        break;
      case 1:
        console.log('There is 1 expense.');
        break;
      default:
        console.log(`There are ${numberOfRows} expenses.`);
        break;
    }
  }

  displayTotal(res) {
    console.log('-'.repeat(65));
  
    let total = res.rows.reduce((acc, val) => acc + Number(val.amount), 0);
    console.log(`Total` + `${total.toFixed(2)}`.padStart(30, ' '));
  }

  async list() {
    await this.client.connect().catch(err => logAndExit(err));
    await this.setup_schema();

    let res = await this.client
      .query("SELECT * FROM expenses ORDER BY created_on ASC")
      .catch(err => logAndExit(err));

    let numberOfRows = res.rowCount;
    this.displayNumberOfExpenses(numberOfRows);

    if (numberOfRows !== 0) {
      this.displayRows(res);
      this.displayTotal(res);
    }

    await this.client.end().catch(err => logAndExit(err));
  }

  async add(amount, memo) {
    await this.client.connect().catch(err => logAndExit(err));
    await this.setup_schema();
    let date = new Date();
    date = date.toLocaleDateString();

    const queryText = "INSERT INTO expenses (amount, memo, created_on) VALUES ($1, $2, $3)";
    const queryValues = [amount, memo, date];
    await this.client
      .query(queryText, queryValues)
      .catch(err => logAndExit(err));

    await this.client.end().catch(err => logAndExit(err));
  }

  async search(searchTerm) {
    await this.client.connect().catch(err => logAndExit(err));
    await this.setup_schema();

    const queryText = `SELECT * FROM expenses WHERE memo ILIKE $1 ORDER BY created_on ASC`;
    const queryValues = [`%${searchTerm}%`];

    let res = await this.client
      .query(queryText, queryValues)
      .catch(err => logAndExit(err));

    let numberOfRows = res.rowCount;
    this.displayNumberOfExpenses(numberOfRows);

    if (numberOfRows !== 0) {
      this.displayRows(res);
      this.displayTotal(res);
    }
  
    await this.client.end().catch(err => logAndExit(err));
  }

  async delete(id) {
    await this.client.connect().catch(err => logAndExit(err));
    await this.setup_schema();

    const selectText = 'SELECT * FROM expenses WHERE id = $1';
    const queryValues = [id];

    let row = await this.client
      .query(selectText, queryValues)
      .catch(err => logAndExit(err));

    if (row.rowCount === 0) {
      console.log(`There is no expense with the id '${id[0]}'.`);
    } else {
      const deleteText = 'DELETE FROM expenses WHERE id = $1';

      console.log('The following expense has been deleted:');
      this.displayRows(row);
      await this.client
        .query(deleteText, queryValues)
        .catch(err => logAndExit(err));
    }

    await this.client.end().catch(err => logAndExit(err));
  }

  async clear() {
    await this.client.connect().catch(err => logAndExit(err));
    await this.setup_schema();
    await this.client.query('DELETE FROM expenses').catch(err => logAndExit(err));
    await this.client.end().catch(err => logAndExit(err));
  }
}

class CLI {
  static HELP = `An expense recording system

Commands:
  
add AMOUNT MEMO [DATE] - record a new expense,
clear - delete all expenses,
list - list all expenses,
delete NUMBER - remove expense with id NUMBER,
search QUERY - list expenses with a matching memo field`

  constructor() {
    this.application = new ExpenseData();
  }

  logError() {
    console.log("Missing arguments!");
  }

  displayHelp() {
    console.log(CLI.HELP);
  }

  run(args) {
    let command = args[2];

    if (command === 'list') {
      this.application.list();
    } else if (command === 'add') {
      let amount = args[3];
      let memo = args[4];

      if (amount && memo) this.application.add(amount, memo)
      else this.logError();
    } else if (command === 'search') {
      let searchTerm = args[3];

      if (searchTerm) this.application.search(searchTerm);
      else this.logError();
    } else if (command === 'delete') {
      let id = args[3];

      if (id) this.application.delete(id);
      else this.logError();
    } else if (command === 'clear') {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      let confirmationText = 'This will remove all expenses. Are you sure? (enter y to confirm)';

      rl.question(confirmationText, (answer) => {
        if (answer === 'y') this.application.clear();
        rl.close();
      })
    } else {
      this.displayHelp();
    }
  }
}

let cli = new CLI();
cli.run(PROCESS.argv);