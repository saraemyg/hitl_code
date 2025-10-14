# haha

How To run : ------------------------------------------------------------

Terminal 1 : 
- npm run dev

Terminal 2 :
- conda activate (yourenvironmentname)
- cd backend
- python main.py

Folder structure : ------------------------------------------------------

/src : 

Pages :
1. SummaryPage.tsx : Main Image Gallery for All Defect as References
2. -> DashboardPage.tsx : Data Visualisation of Current Data (Defect,Validation) 
3. ValidationPage.tsx : Main Validation Page, Navigator ( very important page )
4. -> AnnotationPage.tsx (WIP) : To fix validation bbox

Components : 
- ComfirmModal.tsx : Comfirmation text popup before certain action ( general )
- ImageViewer.tsx : Image configurations, settings and format ( general )
- InfoPanel.tsx : On Right side of ValidationPage.tsx, read Detection Details & Image Info 
- ProgressBar.tsx : On Top side of ValidationPage.tsx, Progress & Folder managements (Upload, Run Detection, Convert, Download)
- ValidationControls.tsx : On Bottom of ValidationPage.tsx, controller for main validation activity

Hooks : 
- useDetectionData.ts : Main metadata handler for fetch, reload, navigation, optimisation ( very important )

Context : 
- MetadataContext.tsx (WIP) : To allow interchanging between different data modules in MongoDB



