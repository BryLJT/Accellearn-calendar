import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { Button } from './Button';
import { Trash2, UserPlus, Shield, User as UserIcon } from 'lucide-react';
import { Modal } from './Modal';

interface UserManagementProps {
  users: User[];
  onAddUser: (user: User) => void;
  onDeleteUser: (userId: string) => void;
}

export const UserManagement: React.FC<UserManagementProps> = ({ users, onAddUser, onDeleteUser }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    name: '',
    username: '',
    password: '',
    role: UserRole.USER
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAddUser({
      ...newUser,
      id: crypto.randomUUID(),
      avatarUrl: `https://picsum.photos/seed/${newUser.username}/200`
    });
    setIsModalOpen(false);
    setNewUser({ name: '', username: '', password: '', role: UserRole.USER });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Team Members</h2>
          <p className="text-slate-500">Manage access and roles.</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          <UserPlus size={16} className="mr-2" />
          Add Member
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {users.map(user => (
          <div key={user.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <img 
                src={user.avatarUrl} 
                alt={user.name} 
                className="w-10 h-10 rounded-full bg-slate-100 object-cover"
              />
              <div>
                <h3 className="font-semibold text-slate-900">{user.name}</h3>
                <div className="flex items-center text-xs text-slate-500 space-x-1">
                  {user.role === UserRole.ADMIN ? <Shield size={12} className="text-indigo-500" /> : <UserIcon size={12} />}
                  <span className="capitalize">{user.role.toLowerCase()}</span>
                  <span>•</span>
                  <span>@{user.username}</span>
                </div>
              </div>
            </div>
            {user.username !== 'admin' && (
              <button 
                onClick={() => onDeleteUser(user.id)}
                className="text-slate-400 hover:text-red-500 transition-colors"
                title="Delete user"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        ))}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add New Member"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
            <input
              required
              type="text"
              value={newUser.name}
              onChange={e => setNewUser({...newUser, name: e.target.value})}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
              placeholder="e.g. Sarah Smith"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
            <input
              required
              type="text"
              value={newUser.username}
              onChange={e => setNewUser({...newUser, username: e.target.value})}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
              placeholder="e.g. sarah"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input
              required
              type="password"
              value={newUser.password}
              onChange={e => setNewUser({...newUser, password: e.target.value})}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
            <select
              value={newUser.role}
              onChange={e => setNewUser({...newUser, role: e.target.value as UserRole})}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
            >
              <option value={UserRole.USER}>User</option>
              <option value={UserRole.ADMIN}>Admin</option>
            </select>
          </div>
          <div className="flex justify-end pt-4">
            <Button type="submit">Create Account</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};