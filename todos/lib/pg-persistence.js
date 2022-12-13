const { dbQuery } = require('./db-query');
const bcrypt = require('bcrypt');

module.exports = class PgPersistence {
  constructor(session) {
    this.username = session.username;
  }

  isDoneTodoList(todoList) {
    return todoList.todos.length > 0 && todoList.todos.every(todo => todo.done);
  }

  hasUndoneTodos(todoList) {
    return todoList.todos.some(todo => !todo.done);
  }

  _partitionTodoLists(todoLists) {
    let undone = [];
    let done = [];

    todoLists.forEach(todoList => {
      if (this.isDoneTodoList(todoList)) {
        done.push(todoList)
      } else {
        undone.push(todoList);
      }
    });

    return undone.concat(done);
  }

  async sortedTodoLists() {
    const ALL_TODOLISTS = "SELECT * FROM todolists" +
                          "  WHERE username = $1" + 
                          "    ORDER BY lower(title) ASC";
    const FIND_TODOS = "SELECT * FROM todos" + 
                       "  WHERE todolist_id = $1";

    let result = await dbQuery(ALL_TODOLISTS, this.username);
    let todoLists = result.rows;

    for (let idx = 0; idx < todoLists.length; idx += 1) {
      let todoList = todoLists[idx];
      let todos = await dbQuery(FIND_TODOS, todoList.id);
      todoList.todos = todos.rows;
    }

    return this._partitionTodoLists(todoLists);
  }

  async sortedTodos(todoList) {
    const FIND_TODOS = 'SELECT * FROM todos' +
                       '  WHERE todolist_id = $1 AND username = $2' + 
                       '    ORDER BY done, lower(title)';
    let resultTodos = await dbQuery(FIND_TODOS, todoList.id, this.username);
    return resultTodos.rows;
  }

  async loadTodoList(todoListId) {
    const FIND_TODOLIST = "SELECT * FROM todolists" + 
                          "  WHERE id = $1 AND username = $2";
    const FIND_TODOS = "SELECT * FROM todos" +
                       "  WHERE todolist_id = $1 AND username = $2";

    let resultTodoList = dbQuery(FIND_TODOLIST, todoListId, this.username);
    let resultTodos = dbQuery(FIND_TODOS, todoListId, this.username);
    let resultBoth = await Promise.all([resultTodoList, resultTodos]);
    
    let todoList = resultBoth[0].rows[0];
    if (!todoList) return undefined;

    todoList.todos = resultBoth[1].rows;
    return todoList;
  }

  async loadTodo(todoListId, todoId) {
    const LOAD_TODO = "SELECT * FROM todos" +
                      "  WHERE todolist_id = $1 AND id = $2 AND username = $3";

    let result = await dbQuery(LOAD_TODO, todoListId, todoId, this.username);
    if (result.rows.length === 0) return undefined;
    return result.rows[0];
  }

  async toggleTodoDoneStatus(todoListId, todoId) {
    const TOGGLE_DONE = "UPDATE todos SET done = NOT done" +
                        "  WHERE todolist_id = $1 AND id = $2 AND username = $3";

    let result = await dbQuery(TOGGLE_DONE, todoListId, todoId, this.username);
    return result.rowCount > 0;
  }

  async deleteTodo(todoListId, todoId) {
    const DELETE_TODO = "DELETE FROM todos" +
                        "  WHERE todolist_id = $1 AND id = $2 AND username = $3";
    let result = await dbQuery(DELETE_TODO, todoListId, todoId, this.username);
    return result.rowCount > 0;
  }

  async markAllTodosDone(todoListId) {
    const MARK_ALL_TODOS_DONE = "UPDATE todos SET done = true" +
                                "  WHERE done = false AND todolist_id = $1 AND username = $2";

    let result = await dbQuery(MARK_ALL_TODOS_DONE, todoListId, this.username);
    return result.rowCount > 0;
  }

  async addTodo(todoListId, title) {
    const CREATE_TODO = "INSERT INTO todos (todolist_id, title, username)" +
                        "VALUES ($1, $2, $3)";
    
    let result = await dbQuery(CREATE_TODO, todoListId, title, this.username);
    return result.rowCount > 0;
  }

  async deleteTodoList(todoListId) {
    const DELETE_TODOLIST = "DELETE FROM todolists" +
                            "  WHERE id = $1 AND username = $2";
    
    let result = await dbQuery(DELETE_TODOLIST, todoListId, this.username);
    return result.rowCount > 0;
  }

  async setTitleTodoList(todoListId, todoListTitle) {
    const UPDATE_TITLE = "UPDATE todolists SET title = $1" +
                         "WHERE id = $2 AND username = $3";

    let result = await dbQuery(UPDATE_TITLE, todoListTitle, todoListId, this.username);
    return result.rowCount > 0;
  }

  async existsTodoListTitle(todoListTitle) {
    // return this._todoLists.some(todoList => todoList.title === todoListTitle);
    const FIND_TODOLIST = "SELECT * FROM todolists" + 
                          "  WHERE title = $1 AND username = $2";

    let result = await dbQuery(FIND_TODOLIST, todoListTitle, this.username);
    return result.rowCount > 0;
  }

  async createTodoList(todoListTitle) {
    const CREATE_TODOLIST = "INSERT INTO todolists (title, username) VALUES ($1, $2)";

    try {
      let result = await dbQuery(CREATE_TODOLIST, todoListTitle, this.username);
      return result.rowCount > 0;
    } catch (error) {
      if (this.isUniqueConstraintViolation(error)) return false;
      throw error;
    }
  }

  isUniqueConstraintViolation(error) {
    return /duplicate key value violates unique constraint/.test(String(error));
  }

  async authenticate(username, password) {
    const FIND_HASHED_PASSWORD = "SELECT password FROM users" +
                                 "  WHERE username = $1";

    let result = await dbQuery(FIND_HASHED_PASSWORD, username);
    if (result.rowCount === 0) return false;

    return await bcrypt.compare(password, result.rows[0].password);
  }
};
