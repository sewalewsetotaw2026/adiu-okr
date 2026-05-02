import React, { useState } from "react";
import { MdKeyboardArrowDown, MdKeyboardArrowUp, MdAdd, MdCheck, MdDelete } from "react-icons/md";
import CardMenu from "./CardMenu";
import Modal from "../common/Modal";
import Button from "../Core/ui/Button";
import FormField from "../common/FormField";
import toast from "react-hot-toast";

const TodoItem = ({ todo, onToggle, onDelete }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className={`rounded-lg mb-2 last:mb-0 transition-all duration-200 border ${isExpanded ? "bg-blue-50 border-blue-100 shadow-sm" : "bg-white border-transparent hover:bg-gray-50"
      }`}>
      <div
        className="flex items-center justify-between p-3 cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle(todo.id);
            }}
            className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${todo.completed
                ? "bg-primary border-primary text-white"
                : "border-gray-300 hover:border-primary"
              }`}
          >
            {todo.completed && <MdCheck size={14} />}
          </button>
          <span className={`text-sm font-medium transition-colors ${todo.completed ? "text-gray-400 line-through" : "text-gray-700"
            }`}>
            {todo.text}
          </span>
        </div>
        <button className="text-gray-400 hover:text-k-dark-grey transition-colors">
          {isExpanded ? <MdKeyboardArrowUp size={20} /> : <MdKeyboardArrowDown size={20} />}
        </button>
      </div>

      {isExpanded && (
        <div className="px-3 pb-3 pl-11 animate-in slide-in-from-top-1 duration-200">
          <p className="text-xs text-gray-500 leading-relaxed">
            {todo.details || "No additional details provided for this task."}
          </p>
          <div className="mt-2 flex gap-2 items-center">
            {todo.dueDate && (
              <span className="text-[10px] bg-white border border-gray-200 px-2 py-0.5 rounded text-gray-500">
                Due: {todo.dueDate}
              </span>
            )}
            {todo.priority && (
              <span className={`text-[10px] px-2 py-0.5 rounded border ${todo.priority === 'High'
                  ? 'bg-primary-light text-primary border-primary-light'
                  : 'bg-gray-50 text-gray-600 border-gray-200'
                }`}>
                {todo.priority} Priority
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default function ToDoList() {
  const [todos, setTodos] = useState([
    { id: 1, text: "Complete Onboarding Document Upload", details: "Upload all required identification and tax documents.", completed: false, priority: "High", dueDate: "Today" },
    { id: 2, text: "Follow up on clients on documents", details: "Contact Client X and Y regarding requirements.", completed: false, priority: "Medium", dueDate: "Tomorrow" },
    { id: 3, text: "Design wireframes for LMS", details: "Create low-fidelity wireframes for dashboard.", completed: false, priority: "High", dueDate: "Next Week" },
    { id: 4, text: "Create case study for next IT project", details: "Draft initial outline and gather metrics.", completed: false, priority: "Low", dueDate: "Next Month" },
  ]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newTask, setNewTask] = useState({ text: "", details: "", priority: "Medium", dueDate: "" });

  const handleToggle = (id) => {
    setTodos(todos.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const handleClearCompleted = () => {
    const activeTodos = todos.filter(t => !t.completed);
    if (activeTodos.length === todos.length) {
      toast("No completed tasks to clear", { icon: "ℹ️" });
      return;
    }
    setTodos(activeTodos);
    toast.success("Completed tasks cleared");
  };

  const handleAddTask = (e) => {
    e.preventDefault();
    if (!newTask.text.trim()) return;

    const todo = {
      id: Date.now(),
      ...newTask,
      completed: false
    };

    setTodos([todo, ...todos]);
    setShowAddModal(false);
    setNewTask({ text: "", details: "", priority: "Medium", dueDate: "" });
    toast.success("New task added successfully");
  };

  const actions = [
    { label: "Add New Task", icon: MdAdd, onClick: () => setShowAddModal(true) },
    { label: "Clear Completed", icon: MdDelete, onClick: handleClearCompleted, danger: true },
  ];

  return (
    <>
      <div className="bg-white p-6 rounded-2xl shadow-card h-full flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-k-dark-grey">To-dos</h3>
          <CardMenu actions={actions} />
        </div>

        <div className="space-y-1 overflow-y-auto pr-1 custom-scrollbar flex-1">
          {todos.length > 0 ? (
            todos.map(todo => (
              <TodoItem
                key={todo.id}
                todo={todo}
                onToggle={handleToggle}
              />
            ))
          ) : (
            <div className="text-center py-8 text-gray-400 text-sm">
              No tasks pending. Great job!
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add New Task"
        size="md"
      >
        <form onSubmit={handleAddTask} className="space-y-4">
          <FormField
            label="Task Title"
            name="text"
            value={newTask.text}
            onChange={(e) => setNewTask({ ...newTask, text: e.target.value })}
            placeholder="What needs to be done?"
            required
          />

          <FormField
            label="Details"
            name="details"
            value={newTask.details}
            onChange={(e) => setNewTask({ ...newTask, details: e.target.value })}
            placeholder="Add more context..."
            type="textarea"
            rows="3"
            inputClassName="resize-none py-2"
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              label="Due Date"
              name="dueDate"
              type="date"
              value={newTask.dueDate}
              onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
            />

            <FormField
              label="Priority"
              name="priority"
              type="select"
              value={newTask.priority}
              onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
              options={[
                { value: "Low", label: "Low" },
                { value: "Medium", label: "Medium" },
                { value: "High", label: "High" },
              ]}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowAddModal(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="flex-1"
            >
              Add Task
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
