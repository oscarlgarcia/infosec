import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { LanguageProvider } from './i18n/LanguageContext'
import { AuthProvider } from './contexts/AuthContext'
import './styles/App.css'
import { Home } from './pages/Home'
import { AskKnowledgeBase } from './pages/AskKnowledgeBase'
import { Settings } from './pages/Settings'
import { CMS } from './pages/CMS'
import { LoginPage } from './pages/Login'
import { ProtectedRoute } from './components/ProtectedRoute'
import { UserHome } from './pages/UserHome'
import { SmeManagerHome } from './pages/SmeManagerHome'
import { AdminHome } from './pages/AdminHome'
import { RoleBasedHome } from './pages/RoleBasedHome'
import { QAPage } from './pages/QA'
import { KnowledgeBasePage } from './pages/KnowledgeBase'
import { KBDocumentsPage } from './pages/KBDocuments'
import { KBEmbeddingsPage } from './pages/KBEmbeddings'
import { AnswerBuilderPage } from './pages/AnswerBuilder'
import { AnalyticsDashboardPage } from './pages/AnalyticsDashboard'
import { ContradictionAnalyzerPage } from './pages/ContradictionAnalyzer'
import { KbCandidatesPage } from './pages/KbCandidates'
import { KnowledgeGraphPage } from './pages/KnowledgeGraph'
import { GapFinderPage } from './pages/GapFinder'
import { AgentsConfigurator } from './pages/AgentsConfigurator'
import { RulesManager } from './pages/RulesManager'
import { TasksKanban } from './pages/TasksKanban'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <LanguageProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LoginPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/app"
              element={
                <ProtectedRoute>
                  <RoleBasedHome />
                </ProtectedRoute>
              }
            />
            <Route
              path="/chat"
              element={
                <ProtectedRoute>
                  <AskKnowledgeBase />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ask"
              element={
                <ProtectedRoute>
                  <AskKnowledgeBase />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/cms"
              element={
                <ProtectedRoute>
                  <CMS />
                </ProtectedRoute>
              }
            />
            <Route
              path="/knowledge-base"
              element={
                <ProtectedRoute>
                  <KnowledgeBasePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/kb-documents"
              element={
                <ProtectedRoute>
                  <KBDocumentsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/kb-embeddings"
              element={
                <ProtectedRoute>
                  <KBEmbeddingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/answer-builder"
              element={
                <ProtectedRoute>
                  <AnswerBuilderPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/analytics"
              element={
                <ProtectedRoute>
                  <AnalyticsDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/contradictions"
              element={
                <ProtectedRoute>
                  <ContradictionAnalyzerPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/kb-candidates"
              element={
                <ProtectedRoute>
                  <KbCandidatesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/qa"
              element={
                <ProtectedRoute>
                  <QAPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/knowledge-graph"
              element={
                <ProtectedRoute>
                  <KnowledgeGraphPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/gap-finder"
              element={
                <ProtectedRoute>
                  <GapFinderPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/agents-configurator"
              element={
                <ProtectedRoute>
                  <AgentsConfigurator />
                </ProtectedRoute>
              }
            />
            <Route
              path="/rules-manager"
              element={
                <ProtectedRoute>
                  <RulesManager />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tasks"
              element={
                <ProtectedRoute>
                  <TasksKanban />
                </ProtectedRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </LanguageProvider>
    </AuthProvider>
  </React.StrictMode>,
)
