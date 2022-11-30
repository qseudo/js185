const express = require("express");
const morgan = require("morgan");
const flash = require("express-flash");
const session = require("express-session");
const { body, validationResult } = require("express-validator");
const store = require("connect-loki");
const SessionPersistence = require('./lib/session-persistence');

const app = express();
const host = "localhost";
const port = 3001;
const LokiStore = store(session);

app.set("views", "./views");
app.set("view engine", "pug");

app.use(morgan("common"));
app.use(express.static("public"));
app.use(express.urlencoded({ extended: false }));
app.use(session({
  cookie: {
    httpOnly: true,
    maxAge: 31 * 24 * 60 * 60 * 1000, // 31 days in millseconds
    path: "/",
    secure: false,
  },
  name: "launch-school-todos-session-id",
  resave: false,
  saveUninitialized: true,
  secret: "this is not very secure",
  store: new LokiStore({}),
}));

app.use(flash());

// Create a new datastore
app.use((req, res, next) => {
  res.locals.store = new SessionPersistence(req.session);
  next();
});


// Extract session info
app.use((req, res, next) => {
  res.locals.flash = req.session.flash;
  delete req.session.flash;
  next();
});

// Redirect start page
app.get("/", (req, res) => {
  res.redirect("/lists");
});

// Render the list of todo lists
app.get("/lists", (req, res) => {
  let store = res.locals.store;
  let todoLists = store.sortedTodoLists();

  let todosInfo = todoLists.map(todoList => ({
    countAllTodos: todoList.todos.length,
    countDoneTodos: todoList.todos.filter(todo => todo.done).length,
    isDone: store.isDoneTodoList(todoList),
  }));

  res.render("lists", {
    todoLists,
    todosInfo,
  });
});

// Render new todo list page
app.get("/lists/new", (req, res) => {
  res.render("new-list");
});

// Create a new todo list
app.post("/lists",
  [
    body("todoListTitle")
      .trim()
      .isLength({ min: 1 })
      .withMessage("The list title is required.")
      .isLength({ max: 100 })
      .withMessage("List title must be between 1 and 100 characters.")
  ],
  (req, res, next) => {
    let rerenderNewListPage = () => {
      res.render("new-list", {
        flash: req.flash(),
        todoListTitle,
      });
    };

    let todoListTitle = req.body.todoListTitle;
    let store = res.locals.store;

    let errors = validationResult(req);
    if (!errors.isEmpty()) {
      errors.array().forEach(message => req.flash("error", message.msg));
      rerenderNewListPage();
    } else if (store.existsTodoListTitle(todoListTitle)) {
      req.flash("error", "The list title must be unique.");
      rerenderNewListPage();
    } else {
      let newTodoListCreated = store.createTodoList(todoListTitle);
      if (!newTodoListCreated) {
        next(new Error("Failed to create new todo list."));
      } else {
        req.flash("success", "The todo list has been created.");
        res.redirect("/lists");
      }
    }
  }
);

// Render individual todo list and its todos
app.get("/lists/:todoListId", (req, res, next) => {
  let todoListId = req.params.todoListId;
  let todoList = res.locals.store.loadTodoList(+todoListId);
  if (todoList === undefined) {
    next(new Error("Not found."));
  } else {
    todoList.todos = res.locals.store.sortedTodos(todoList);

    res.render("list", {
      todoList,
      isDoneTodoList: res.locals.store.isDoneTodoList(todoList),
      hasUndoneTodos: res.locals.store.hasUndoneTodos(todoList),
    });
  }
});

// Toggle completion status of a todo
app.post("/lists/:todoListId/todos/:todoId/toggle", (req, res, next) => {
  let { todoListId, todoId } = { ...req.params };
  let todoHasBeenToggled = res.locals.store.toggleTodoDoneStatus(+todoListId, +todoId);
  if (!todoHasBeenToggled) {
    next(new Error("Todo not found."));
  } else {
    let todo = res.locals.store.loadTodo(+todoListId, +todoId);
    if (todo.done) {
      req.flash("success", `"${todo.title}" marked as done!`);
    } else {
      req.flash("success", `"${todo.title}" marked NOT done.`);
    }

    res.redirect(`/lists/${todoListId}`);
  }
});

// Delete a todo
app.post("/lists/:todoListId/todos/:todoId/destroy", (req, res, next) => {
  let { todoListId, todoId } = { ...req.params };

  let todoHasBeenDeleted = res.locals.store.deleteTodo(+todoListId, +todoId);

  if (!todoHasBeenDeleted) {
    next(new Error("Not found."));
  } else {
    req.flash("success", "The todo has been deleted.");
    res.redirect(`/lists/${todoListId}`);
    }
});

// Mark all todos as done
app.post("/lists/:todoListId/complete_all", (req, res, next) => {
  let todoListId = req.params.todoListId;
  let todosMarkedCompleted = res.locals.store.markAllTodosDone(+todoListId);

  if (!todosMarkedCompleted) {
    next(new Error("Not found."));
  } else {
    req.flash("success", "All todos have been marked as done.");
    res.redirect(`/lists/${todoListId}`);
  }
});

// Create a new todo and add it to the specified list
app.post("/lists/:todoListId/todos",
  [
    body("todoTitle")
      .trim()
      .isLength({ min: 1 })
      .withMessage("The todo title is required.")
      .isLength({ max: 100 })
      .withMessage("Todo title must be between 1 and 100 characters."),
  ],
  (req, res, next) => {
    let todoListId = req.params.todoListId;
    let todoList = res.locals.store.loadTodoList(+todoListId);
    let todoTitle = req.body.todoTitle;

    if (!todoList) {
      next(new Error("Not found."));
    } else {
      let errors = validationResult(req);
      if (!errors.isEmpty()) {
        errors.array().forEach(message => req.flash("error", message.msg));

        todoList.todos = res.locals.store.sortedTodos(todoList);
        res.render("list", {
          flash: req.flash(),
          todoList: todoList,
          hasUndoneTodos: res.locals.store.hasUndoneTodos(todoList),
          isDoneTodoList: res.locals.store.isDoneTodoList(todoList),
          todoTitle,
        });
      } else {
        let todoCreated = res.locals.store.addTodo(+todoListId, todoTitle);
        if (!todoCreated) {
          next(new Error("Not found."));
        } else {
          req.flash("success", "The todo has been created.");
          res.redirect(`/lists/${todoListId}`);
        }
      }
    }
  }
);

// Render edit todo list form
app.get("/lists/:todoListId/edit", (req, res, next) => {
  let todoListId = req.params.todoListId;
  let todoList = res.locals.store.loadTodoList(+todoListId);
  if (!todoList) {
    next(new Error("Not found."));
  } else {
    res.render("edit-list", { todoList });
  }
});

// Delete todo list
app.post("/lists/:todoListId/destroy", (req, res, next) => {
  let todoListId = req.params.todoListId;
  let todoListHasBeenDeleted = res.locals.store.deleteTodoList(+todoListId);

  if (!todoListHasBeenDeleted) {
    next(new Error("Not found."));
  } else {
    req.flash("success", "Todo list deleted.");
    res.redirect("/lists");
  }
});

// Edit todo list title
app.post("/lists/:todoListId/edit",
  [
    body("todoListTitle")
      .trim()
      .isLength({ min: 1 })
      .withMessage("The list title is required.")
      .isLength({ max: 100 })
      .withMessage("List title must be between 1 and 100 characters.")
  ],
  (req, res, next) => {
    let store = res.locals.store;
    let todoListId = req.params.todoListId;
    let todoListTitle = req.body.todoListTitle;

    const rerenderEditList = () => {
      let todoList = store.loadTodoList(+todoListId);
      if (!todoList) {
        next(new Error("Not found."));
      } else {
        res.render("edit-list", {
          todoListTitle,
          todoList,
          flash: req.flash(),
        });
      }
    };
    
    let errors = validationResult(req);
    if (!errors.isEmpty()) {
      errors.array().forEach(message => req.flash("error", message.msg));
      rerenderEditList();
    } else if (store.existsTodoListTitle(todoListTitle)) {
      req.flash("error", "The list title must be unique.");
      rerenderEditList();
    } else if (!store.setTitleTodoList(+todoListId, todoListTitle)) {
      next(new Error("Not found."));
    } else {
      req.flash("success", "Todo list updated.");
      res.redirect(`/lists/${todoListId}`);
    }
  }
);

// Error handler
app.use((err, req, res, _next) => {
  console.log(err); // Writes more extensive information to the console log
  res.status(404).send(err.message);
});

// Listener
app.listen(port, host, () => {
  console.log(`Todos is listening on port ${port} of ${host}!`);
});
