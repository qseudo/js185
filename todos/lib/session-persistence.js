const SeedData = require('./seed-data');
const deepCopy = require('./deep-copy');
const { sortTodoLists, sortTodos } = require('./sort');
const nextId = require('./next-id');

module.exports = class SessionPersistence {
  constructor(session) {
    this._todoLists = session.todoLists || deepCopy(SeedData);
    session.todoLists = this._todoLists;
  }

  // Are all of the todos in the todo list done? If the todo list has at least one todo and all of its todos are marked done, then the todo list is done. Otherwise, it is undone.
  isDoneTodoList(todoList) {
    return todoList.todos.length > 0 && todoList.todos.every(todo => todo.done);
  }

  hasUndoneTodos(todoList) {
    return todoList.todos.some(todo => !todo.done);
  }

  // returns a copy of the list of todo lists sorted by completion status and title (case-insensitive)
  sortedTodoLists() {
    let todoLists = deepCopy(this._todoLists);
    let undone = todoLists.filter(todoList => !this.isDoneTodoList(todoList));
    let done = todoLists.filter(todoList => this.isDoneTodoList(todoList));
    return sortTodoLists(undone, done);
  }

  sortedTodos(todoList) {
    let todos = todoList.todos;
    let undone = todos.filter(todo => !todo.done);
    let done = todos.filter(todo => todo.done);
    return deepCopy(sortTodos(undone, done));
  }

  loadTodoList(todoListId) {
    let todoList = this._findTodoList(todoListId);
    return deepCopy(todoList);
  }

  loadTodo(todoListId, todoId) {
    let todo = this._findTodo(todoListId, todoId);
    return deepCopy(todo);
  }

  // prepending with underscore notes a method intended for private use only, since these methods return the original data object, and not a copy
  _findTodoList(todoListId) {
    return this._todoLists.find(todoList => todoList.id === todoListId);
  }

  // prepending with underscore notes a method intended for private use only, since these methods return the original data object, and not a copy
  _findTodo(todoListId, todoId) {
    let todoList = this._findTodoList(todoListId);
    return todoList.todos.find(todo => todo.id === todoId);
  }

  toggleTodoDoneStatus(todoListId, todoId) {
    let todo = this._findTodo(todoListId, todoId);
    if (!todo) return false;

    todo.done = !todo.done;
    return true;
  }

  deleteTodo(todoListId, todoId) {
    let todoList = this._findTodoList(todoListId);
    if (!todoList) return false;
    let indexOfTodo = todoList.todos.findIndex(todo => todo.id === todoId);
    if (indexOfTodo === -1) return false;

    todoList.todos.splice(indexOfTodo, 1);
    return true;
  }

  markAllTodosDone(todoListId) {
    let todoList = this._findTodoList(todoListId);
    if (!todoList) return false;

    todoList.todos
      .filter(todo => !todo.done)
      .forEach(todo => todo.done = true);
    return true;
  }

  addTodo(todoListId, title) {
    let todoList = this._findTodoList(todoListId);
    if (!todoList) return false;

    let todo = {
      id: nextId(),
      title,
      done: false,
    };

    todoList.todos.push(todo);
    return true;
  }

  deleteTodoList(todoListId) {
    let indexOfTodoList = this._todoLists.find(todoList => todoList.id === todoListId);
    if (indexOfTodoList === -1) return false;

    this._todoLists.splice(indexOfTodoList, 1);
    return true;
  }

  setTitleTodoList(todoListId, todoListTitle) {
    let todoList = this._findTodoList(todoListId);
    if (!todoList) return false;

    todoList.title = todoListTitle;
    return true;
  }
};

