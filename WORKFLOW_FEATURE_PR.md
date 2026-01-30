# Visual Workflow Designer Feature

## Overview
This PR introduces a comprehensive visual workflow designer feature to AnythingLLM, enabling users to create, manage, and execute complex AI workflows through an intuitive drag-and-drop interface.

## Features

### 1. Visual Workflow Designer
- **Drag-and-Drop Interface**: Intuitive canvas-based workflow creation
- **Node-Based Architecture**: Modular design with various node types
- **Real-time Preview**: Visual feedback during workflow construction
- **Auto-save**: Automatic saving to localStorage with history management

### 2. Supported Node Types

#### Trigger Nodes
- Manual Trigger
- Schedule Trigger (Cron-based)
- Webhook Trigger

#### LLM Nodes
- DeepSeek V3 Integration
- Google Gemini Flash
- Qwen (通义千问)
- Configurable system prompts and parameters

#### Logic Nodes
- Conditional Branching
- Loop/Iteration
- JavaScript Code Execution
- Python Code Execution (planned)

#### Data Nodes
- HTTP Request
- Database Query
- RAG Query (Knowledge Retrieval)

#### Output Nodes
- Chat Output
- Image Generation
- Image Processing

### 3. Workflow Execution Engine
- **Parallel Execution**: Support for concurrent node execution
- **Conditional Branching**: Dynamic flow control based on conditions
- **Error Handling**: Comprehensive error tracking and logging
- **Execution Logs**: Detailed step-by-step execution tracking
- **Result Visualization**: Real-time execution results display

### 4. Workflow Management
- **Save/Load**: Persistent workflow storage
- **Import/Export**: Share workflows between instances
- **Version Control**: Undo/Redo functionality
- **Workflow Library**: Manage multiple workflows

### 5. AI-Powered Workflow Generation
- **Natural Language Input**: Describe workflows in plain language
- **Auto-generation**: AI creates workflow structure automatically
- **Smart Suggestions**: Context-aware node recommendations

### 6. Integration with Chat Interface
- **Workflow Selector**: Choose workflows directly from chat input
- **One-Click Execution**: Run workflows with user input
- **Result Integration**: Workflow outputs appear in chat history

## Technical Implementation

### Frontend Components
```
frontend/src/pages/WorkflowDesigner/
├── index.jsx                 # Main workflow designer component
├── nodeTypes.js              # Node type definitions
└── components/               # Sub-components

frontend/src/components/WorkspaceChat/ChatContainer/PromptInput/
└── WorkflowSelector/         # Workflow selector in chat
    └── index.jsx
```

### Backend Endpoints
```
server/endpoints/
└── agentFlows.js             # Workflow API endpoints
    ├── POST /agent-flows/save
    ├── GET  /agent-flows/list
    ├── GET  /agent-flows/:uuid
    ├── DELETE /agent-flows/:uuid
    └── POST /agent-flows/:uuid/toggle
```

### Data Storage
- **LocalStorage**: Client-side workflow persistence
- **Server Storage**: Optional server-side backup (planned)
- **Format**: JSON-based workflow definition

## Usage Examples

### Example 1: Simple Q&A Workflow
```
[Manual Trigger] → [DeepSeek LLM] → [Chat Output]
```

### Example 2: Conditional Processing
```
[Manual Trigger] → [Condition Node] 
                    ├─ True → [LLM Node A] → [Output]
                    └─ False → [LLM Node B] → [Output]
```

### Example 3: Parallel Processing
```
[Manual Trigger] → [Fork]
                    ├─ [LLM Node 1] ─┐
                    ├─ [LLM Node 2] ─┼→ [Join] → [Output]
                    └─ [LLM Node 3] ─┘
```

### Example 4: RAG + LLM Pipeline
```
[Manual Trigger] → [RAG Query] → [DeepSeek LLM] → [Chat Output]
```

## Configuration

### LLM Configuration
Users can configure LLM endpoints and API keys through the settings panel:
- API Endpoint
- API Key
- Model Selection
- Temperature
- Max Tokens

### Workflow Settings
- Auto-save interval
- Execution timeout
- Parallel execution limits
- Error handling strategy

## Benefits

1. **No-Code AI Workflows**: Create complex AI pipelines without coding
2. **Reusability**: Save and reuse workflows across projects
3. **Flexibility**: Mix and match different AI models and logic
4. **Transparency**: Visual representation of AI processing flow
5. **Debugging**: Step-by-step execution logs for troubleshooting
6. **Scalability**: Support for complex multi-step workflows

## Future Enhancements

- [ ] Server-side workflow execution
- [ ] Workflow templates marketplace
- [ ] Advanced debugging tools
- [ ] Workflow versioning and rollback
- [ ] Collaborative workflow editing
- [ ] More node types (Email, SMS, Database, etc.)
- [ ] Workflow scheduling and automation
- [ ] Performance metrics and analytics
- [ ] Workflow testing framework
- [ ] API integration for external services

## Testing

### Manual Testing Checklist
- [x] Create new workflow
- [x] Add and configure nodes
- [x] Connect nodes
- [x] Execute workflow
- [x] Save and load workflow
- [x] Undo/Redo operations
- [x] AI workflow generation
- [x] Workflow selector in chat
- [x] Parallel execution
- [x] Conditional branching
- [x] Error handling

### Browser Compatibility
- [x] Chrome/Edge
- [x] Firefox
- [x] Safari
- [ ] Mobile browsers (planned)

## Breaking Changes
None. This is a new feature that doesn't affect existing functionality.

## Migration Guide
No migration needed. This is an additive feature.

## Documentation
- User guide included in the workflow designer interface
- Tooltips and help text for all node types
- Example workflows provided

## Screenshots

### Workflow Designer Interface
![Workflow Designer](docs/screenshots/workflow-designer.png)

### Workflow Execution
![Workflow Execution](docs/screenshots/workflow-execution.png)

### Workflow Selector in Chat
![Workflow Selector](docs/screenshots/workflow-selector.png)

## Related Issues
- Closes #[issue-number] (if applicable)

## Checklist
- [x] Code follows project style guidelines
- [x] Self-review completed
- [x] Comments added for complex logic
- [x] Documentation updated
- [x] No new warnings generated
- [x] Manual testing completed
- [ ] Unit tests added (planned)
- [ ] Integration tests added (planned)

## Additional Notes
This feature has been tested extensively in a production environment and has proven to be stable and useful for creating complex AI workflows. The implementation is modular and can be easily extended with new node types.

## License
This contribution is made under the same license as the AnythingLLM project (MIT License).
