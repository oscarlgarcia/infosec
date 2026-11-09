import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { LanguageProvider } from './i18n/LanguageContext'
import { AuthProvider } from './contexts/AuthContext'
import { ChatProvider } from './contexts/ChatContext'
import './styles/App.css'
import { Home } from './pages/Home'
import { AskKnowledgeBase } from './pages/AskKnowledgeBase'
import { Settings } from './pages/Settings'
import { CMS } from './pages/CMS'
import { CMSEditor } from './pages/CMSEditor'
import { SiteIndex } from './pages/SiteIndex'
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
import { AnalyticsDashboardPage } from './pages/AnalyticsDashboard'
import { ContradictionAnalyzerPage } from './pages/ContradictionAnalyzer'
import { KbCandidatesPage } from './pages/KbCandidates'
import { KnowledgeGraphPage } from './pages/KnowledgeGraph'
import { KnowledgeCenter } from './pages/KnowledgeCenter'
import { TermReportNew } from './pages/TermReportNew'
import { TermReportList } from './pages/TermReportList'
import { TermReportDetail } from './pages/TermReportDetail'
import { ScheduledReports } from './pages/ScheduledReports'
import { ScheduleDetail } from './pages/ScheduleDetail'
import { CanonicalAnswers } from './pages/CanonicalAnswers'
import { GapFinderPage } from './pages/GapFinder'
import { AgentsConfigurator } from './pages/AgentsConfigurator'
import { RulesManager } from './pages/RulesManager'
import { TasksKanban } from './pages/TasksKanban'
import { MetricsConfigurator } from './pages/MetricsConfigurator'
import { OrchestratorJobs } from './pages/OrchestratorJobs'
import { RequestsPage } from './pages/RequestsPage'
import { RequestNewPage } from './pages/RequestNewPage'
import { RequestDetailPage } from './pages/RequestDetailPage'
import { ClientsPage } from './pages/ClientsPage'
import { Client360Page } from './pages/Client360Page'
import { DashboardPage } from './pages/DashboardPage'
import { CveListPage } from './pages/CveListPage'
import { CveDetailPage } from './pages/CveDetailPage'
import { CveSyncPage } from './pages/CveSyncPage'
import { SlaPoliciesPage } from './pages/SlaPoliciesPage'
import { NotificationsPage } from './pages/NotificationsPage'
import './styles/request360.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <LanguageProvider>
        <ChatProvider>
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
              path="/chat/:conversationId"
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
              path="/cms/pages/new"
              element={
                <ProtectedRoute>
                  <CMSEditor />
                </ProtectedRoute>
              }
            />
            <Route
              path="/cms/pages/edit/:id"
              element={
                <ProtectedRoute>
                  <CMSEditor />
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
              path="/knowledge-center"
              element={
                <ProtectedRoute>
                  <KnowledgeCenter />
                </ProtectedRoute>
              }
            />
            <Route
              path="/knowledge-center/reports/new"
              element={
                <ProtectedRoute>
                  <TermReportNew />
                </ProtectedRoute>
              }
            />
            <Route
              path="/knowledge-center/reports"
              element={
                <ProtectedRoute>
                  <TermReportList />
                </ProtectedRoute>
              }
            />
            <Route
              path="/knowledge-center/reports/:id"
              element={
                <ProtectedRoute>
                  <TermReportDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/knowledge-center/scheduled"
              element={
                <ProtectedRoute>
                  <ScheduledReports />
                </ProtectedRoute>
              }
            />
            <Route
              path="/knowledge-center/scheduled/:id"
              element={
                <ProtectedRoute>
                  <ScheduleDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/knowledge-center/canonical"
              element={
                <ProtectedRoute>
                  <CanonicalAnswers />
                </ProtectedRoute>
              }
            />
            <Route
              path="/knowledge-center/graph"
              element={
                <ProtectedRoute>
                  <KnowledgeGraphPage />
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
            <Route
              path="/metrics-config"
              element={
                <ProtectedRoute>
                  <MetricsConfigurator />
                </ProtectedRoute>
              }
            />
            <Route
              path="/orchestrator"
              element={
                <ProtectedRoute>
                  <OrchestratorJobs />
                </ProtectedRoute>
              }
            />
            <Route
              path="/requests"
              element={
                <ProtectedRoute>
                  <RequestsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/requests/new"
              element={
                <ProtectedRoute>
                  <RequestNewPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/requests/:id"
              element={
                <ProtectedRoute>
                  <RequestDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/clients"
              element={
                <ProtectedRoute>
                  <ClientsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/clients/:id"
              element={
                <ProtectedRoute>
                  <Client360Page />
                </ProtectedRoute>
              }
            />
            <Route
              path="/clients/:id/:tab"
              element={
                <ProtectedRoute>
                  <Client360Page />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/cve"
              element={
                <ProtectedRoute>
                  <CveListPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/cve/:id"
              element={
                <ProtectedRoute>
                  <CveDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/cve-sync"
              element={
                <ProtectedRoute>
                  <CveSyncPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/sla-policies"
              element={
                <ProtectedRoute>
                  <SlaPoliciesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/notifications"
              element={
                <ProtectedRoute>
                  <NotificationsPage />
                </ProtectedRoute>
              }
            />
            <Route path="/site" element={<SiteIndex />} />
            <Route path="/site/:slug" element={<SiteIndex />} />
          </Routes>
        </BrowserRouter>
      </ChatProvider>
      </LanguageProvider>
    </AuthProvider>
  </React.StrictMode>,
)
