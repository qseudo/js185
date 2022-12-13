const { dbQuery } = require('./db-query');

module.exports = class PgPersistence {
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
    const ALL_TODOLISTS = 'SELECT * FROM todolists ORDER BY lower(title) ASC';
    const FIND_TODOS = 'SELECT * FROM todos WHERE todolist_id = $1';

    let result = await dbQuery(ALL_TODOLISTS);
    let todoLists = result.rows;

    for (let idx = 0; idx < todoLists.length; idx += 1) {
      let todoList = todoLists[idx];
      let todos = await dbQuery(FIND_TODOS, todoList.id);
      todoList.todos = todos.rows;
    }

    return this._partitionTodoLists(todoLists);
  }

  async sortedTodos(todoList) {
    const FIND_TODOS = 'SELECT * FROM todos WHERE todolist_id = $1 ORDER BY done, lower(title)';
    let resultTodos = await dbQuery(FIND_TODOS, todoList.id);
    return resultTodos.rows;
  }

  async loadTodoList(todoListId) {
    const FIND_TODOLIST = "SELECT * FROM todolists WHERE id = $1";
    const FIND_TODOS = "SELECT * FROM todos WHERE todolist_id = $1";

    let resultTodoList = dbQuery(FIND_TODOLIST, todoListId);
    let resultTodos = dbQuery(FIND_TODOS, todoListId);
    let resultBoth = await Promise.all([resultTodoList, resultTodos]);
    
    let todoList = resultBoth[0].rows[0];
    if (!todoList) return undefined;

    todoList.todos = resultBoth[1].rows;
    return todoList;
  }

  async loadTodo(todoListId, todoId) {
    const LOAD_TODO = "SELECT * FROM todos WHERE todolist_id = $1 AND id = $2";

    let result = await dbQuery(LOAD_TODO, todoListId, todoId);
    if (result.rows.length === 0) return undefined;
    return result.rows[0];
  }

  async toggleTodoDoneStatus(todoListId, todoId) {
    const TOGGLE_DONE = "UPDATE todos SET done = NOT done" +
                        " WHERE todolist_id = $1 AND id = $2";

    let result = await dbQuery(TOGGLE_DONE, todoListId, todoId);
    return result.rowCount > 0;
  }

  async deleteTodo(todoListId, todoId) {
    const DELETE_TODO = "DELETE FROM todos WHERE todolist_id = $1 AND id = $2";
    let result = await dbQuery(DELETE_TODO, todoListId, todoId);
    return result.rowCount > 0;
  }

  async markAllTodosDone(todoListId) {
    const MARK_ALL_TODOS_DONE = "UPDATE todos SET done = true" +
                                " WHERE done = false AND todolist_id = $1";

    let result = await dbQuery(MARK_ALL_TODOS_DONE, todoListId);
    return result.rowCount > 0;
  }

  async addTodo(todoListId, title) {
    const CREATE_TODO = "INSERT INTO todos (todolist_id, title)" +
                        "VALUES ($1, $2)";
    
    let result = await dbQuery(CREATE_TODO, todoListId, title);
    return result.rowCount > 0;
  }

  async deleteTodoList(todoListId) {
    const DELETE_TODOLIST = "DELETE FROM todolists WHERE id = $1";
    
    let result = await dbQuery(DELETE_TODOLIST, todoListId);
    return result.rowCount > 0;
  }

  async setTitleTodoList(todoListId, todoListTitle) {
    const UPDATE_TITLE = "UPDATE todolists SET title = $1 WHERE id = $2";

    let result = await dbQuery(UPDATE_TITLE, todoListTitle, todoListId);
    return result.rowCount > 0;
  }

  async existsTodoListTitle(todoListTitle) {
    // return this._todoLists.some(todoList => todoList.title === todoListTitle);
    const FIND_TODOLIST = "SELECT * FROM todolists WHERE title = $1";

    let result = await dbQuery(FIND_TODOLIST, todoListTitle);
    return result.rowCount > 0;
  }

  async createTodoList(todoListTitle) {
    const CREATE_TODOLIST = "INSERT INTO todolists (title) VALUES ($1)";

    try {
      let result = await dbQuery(CREATE_TODOLIST, todoListTitle);
      return result.rowCount > 0;
    } catch (error) {
      if (this.isUniqueConstraintViolation(error)) return false;
      throw error;
    }
  }

  isUniqueConstraintViolation(error) {
    return /duplicate key value violates unique constraint/.test(String(error));
  }
};

