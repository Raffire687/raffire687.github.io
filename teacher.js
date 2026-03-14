// ==================== GLOBAL VARIABLES ====================
let currentTeacher = null;
let currentDate = new Date().toISOString().split('T')[0];
let subjects = [];
let students = [];
let editingStudentId = null;
let editingSubjectId = null;
let realtimeListeners = {};

// ==================== PASSWORD TOGGLE FUNCTIONS ====================
function togglePassword(inputId, iconElement) {
    const passwordInput = document.getElementById(inputId);
    
    if (!passwordInput || !iconElement) return;
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        iconElement.classList.remove('fa-eye-slash');
        iconElement.classList.add('fa-eye');
    } else {
        passwordInput.type = 'password';
        iconElement.classList.remove('fa-eye');
        iconElement.classList.add('fa-eye-slash');
    }
}

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', async () => {
    await initializeData();
    checkAuth();
    
    // Set default dates
    document.getElementById('attendanceDate').value = currentDate;
    document.getElementById('reportDate').value = currentDate;
    
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    document.getElementById('startDate').value = sevenDaysAgo.toISOString().split('T')[0];
    document.getElementById('endDate').value = currentDate;
    
    // Setup realtime listeners
    setupRealtimeListeners();
});

// ==================== DATA INITIALIZATION ====================
async function initializeData() {
    try {
        console.log('Firebase Service initialized');
    } catch (error) {
        console.error('Error initializing data:', error);
    }
}

// ==================== REALTIME LISTENERS ====================
function setupRealtimeListeners() {
    if (!firebaseService.currentTeacher) return;
    
    const teacherId = firebaseService.currentTeacher.id;
    
    if (realtimeListeners.students) {
        database.ref(`teacher_data/${teacherId}/students`).off('value', realtimeListeners.students);
    }
    
    if (realtimeListeners.subjects) {
        database.ref(`teacher_data/${teacherId}/subjects`).off('value', realtimeListeners.subjects);
    }
    
    realtimeListeners.students = database.ref(`teacher_data/${teacherId}/students`).on('value', () => {
        if (document.getElementById('studentsTab').style.display !== 'none') {
            loadStudents();
        }
    });
    
    realtimeListeners.subjects = database.ref(`teacher_data/${teacherId}/subjects`).on('value', () => {
        if (document.getElementById('subjectsTab').style.display !== 'none') {
            loadSubjects();
        }
    });
}

// ==================== AUTHENTICATION ====================
function showRegister() {
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('registerSection').style.display = 'flex';
    clearAuthErrors();
}

function showLogin() {
    document.getElementById('registerSection').style.display = 'none';
    document.getElementById('loginSection').style.display = 'flex';
    clearAuthErrors();
}

function clearAuthErrors() {
    document.getElementById('loginError').style.display = 'none';
    document.getElementById('registerError').style.display = 'none';
}

async function handleLogin() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');

    if (!email || !password) {
        showError(errorDiv, 'Please enter email and password');
        return;
    }

    try {
        const teacher = await firebaseService.loginTeacher(email, password);
        
        if (teacher) {
            currentTeacher = teacher;
            localStorage.setItem('current_teacher', JSON.stringify(currentTeacher));
            
            document.getElementById('teacherName').textContent = teacher.name;
            document.getElementById('loginSection').style.display = 'none';
            document.getElementById('dashboardSection').style.display = 'block';
            
            subjects = [];
            students = [];
            
            await loadStudents();
            await loadSubjects();
            await loadAttendance();
            
            setupRealtimeListeners();
            
            errorDiv.style.display = 'none';
            showNotification(`Welcome back, ${teacher.name}!`, 'success');
        } else {
            showError(errorDiv, 'Invalid email or password');
        }
    } catch (error) {
        showError(errorDiv, 'Login failed: ' + error.message);
    }
}

async function handleRegister() {
    const name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    const confirm = document.getElementById('regConfirm').value;
    const errorDiv = document.getElementById('registerError');

    if (!name || !email || !password) {
        showError(errorDiv, 'Please fill all fields');
        return;
    }

    if (password.length < 6) {
        showError(errorDiv, 'Password must be at least 6 characters');
        return;
    }

    if (password !== confirm) {
        showError(errorDiv, 'Passwords do not match');
        return;
    }

    try {
        const result = await firebaseService.registerTeacher(name, email, password);
        
        if (result.success) {
            alert('Registration successful! Please login with your new account.');
            showLogin();
            document.getElementById('regName').value = '';
            document.getElementById('regEmail').value = '';
            document.getElementById('regPassword').value = '';
            document.getElementById('regConfirm').value = '';
        } else {
            showError(errorDiv, result.message || 'Registration failed');
        }
    } catch (error) {
        showError(errorDiv, 'Registration failed: ' + error.message);
    }
}

function showError(element, message) {
    element.textContent = message;
    element.style.display = 'block';
    setTimeout(() => {
        element.style.display = 'none';
    }, 3000);
}

function logout() {
    localStorage.removeItem('current_teacher');
    currentTeacher = null;
    firebaseService.currentTeacher = null;
    firebaseService.clearLocalData();
    
    subjects = [];
    students = [];
    
    document.getElementById('dashboardSection').style.display = 'none';
    document.getElementById('loginSection').style.display = 'flex';
    
    document.getElementById('loginEmail').value = '';
    document.getElementById('loginPassword').value = '';
    
    showNotification('Logged out successfully', 'info');
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification-popup ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ==================== TAB NAVIGATION ====================
function showTab(tabName) {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    event.target.classList.add('active');

    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.style.display = 'none';
    });
    
    document.getElementById(tabName + 'Tab').style.display = 'block';
    
    if (tabName === 'students') loadStudents();
    if (tabName === 'subjects') loadSubjects();
    if (tabName === 'reports') generateReport();
}

// ==================== SUBJECT MANAGEMENT ====================
async function loadSubjects() {
    try {
        subjects = await firebaseService.getSubjects();
        updateSubjectDropdowns();
        renderSubjectsTable();
    } catch (error) {
        console.error('Error loading subjects:', error);
    }
}

function updateSubjectDropdowns() {
    const selects = ['attendanceSubject', 'studentSubjectFilter', 'reportSubject'];
    
    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (select) {
            select.innerHTML = '<option value="">All Subjects</option>';
            subjects.forEach(subject => {
                select.innerHTML += `<option value="${subject.code}">${subject.code} - ${subject.name}</option>`;
            });
        }
    });

    const checkboxContainer = document.getElementById('subjectCheckboxes');
    if (checkboxContainer) {
        checkboxContainer.innerHTML = '';
        subjects.forEach(subject => {
            const div = document.createElement('div');
            div.className = 'checkbox-item';
            div.innerHTML = `
                <input type="checkbox" id="subj_${subject.code}" value="${subject.code}" checked>
                <label for="subj_${subject.code}">${subject.code} - ${subject.name}</label>
            `;
            checkboxContainer.appendChild(div);
        });
    }
}

function renderSubjectsTable() {
    const tbody = document.getElementById('subjectsBody');
    
    if (!subjects.length) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 30px;">No subjects found. Click "ADD SUBJECT" to create one.</td></tr>';
        return;
    }

    let html = '';
    subjects.forEach(subject => {
        const studentCount = students.filter(s => s.subjects?.some(sub => sub.subjectCode === subject.code)).length;
        
        html += `
            <tr>
                <td><strong>${subject.code}</strong></td>
                <td>${subject.name}</td>
                <td>${subject.schedule || 'TBA'}</td>
                <td>${subject.room || 'TBA'}</td>
                <td>${subject.units || 3}</td>
                <td>${studentCount}</td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn edit" onclick="editSubject('${subject.id}')">✏️</button>
                        <button class="action-btn delete" onclick="deleteSubject('${subject.id}')">🗑️</button>
                        <button class="action-btn" style="background: #8B5CF6;" onclick="pushAnnouncement('${subject.code}', '${subject.name}')">📢</button>
                    </div>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

async function pushAnnouncement(subjectCode, subjectName) {
    const message = prompt(`Enter announcement for ${subjectCode} students:`, "Class will be held online today");
    if (!message) return;
    
    try {
        const enrolledStudents = students.filter(s => s.subjects?.some(sub => sub.subjectCode === subjectCode));
        
        if (enrolledStudents.length === 0) {
            alert('No students enrolled in this subject');
            return;
        }
        
        const result = await firebaseService.pushAnnouncement(subjectCode, subjectName, message, enrolledStudents);
        
        if (result.success) {
            alert(`Announcement sent to ${result.count} students!`);
        } else {
            alert('Failed to send announcement');
        }
    } catch (error) {
        console.error('Error sending announcement:', error);
        alert('Failed to send announcement');
    }
}

function showAddSubject() {
    editingSubjectId = null;
    document.getElementById('subjectModalTitle').textContent = 'ADD NEW SUBJECT';
    document.getElementById('saveSubjectBtn').textContent = 'ADD SUBJECT';
    document.getElementById('subjectCode').value = '';
    document.getElementById('subjectName').value = '';
    document.getElementById('subjectSchedule').value = '';
    document.getElementById('subjectRoom').value = '';
    document.getElementById('subjectUnits').value = '3';
    document.getElementById('subjectModal').classList.add('show');
}

async function editSubject(subjectId) {
    try {
        const subject = subjects.find(s => s.id === subjectId);
        
        if (subject) {
            editingSubjectId = subjectId;
            document.getElementById('subjectModalTitle').textContent = 'EDIT SUBJECT';
            document.getElementById('saveSubjectBtn').textContent = 'UPDATE SUBJECT';
            document.getElementById('subjectCode').value = subject.code || '';
            document.getElementById('subjectName').value = subject.name || '';
            document.getElementById('subjectSchedule').value = subject.schedule || '';
            document.getElementById('subjectRoom').value = subject.room || '';
            document.getElementById('subjectUnits').value = subject.units || 3;
            document.getElementById('subjectModal').classList.add('show');
        }
    } catch (error) {
        console.error('Error loading subject:', error);
        alert('Failed to load subject');
    }
}

function closeSubjectModal() {
    document.getElementById('subjectModal').classList.remove('show');
    editingSubjectId = null;
}

async function addSubject() {
    const code = document.getElementById('subjectCode').value.trim().toUpperCase();
    const name = document.getElementById('subjectName').value.trim();
    const schedule = document.getElementById('subjectSchedule').value.trim();
    const room = document.getElementById('subjectRoom').value.trim();
    const units = parseInt(document.getElementById('subjectUnits').value);

    if (!code || !name) {
        alert('Please enter subject code and name');
        return;
    }

    try {
        let result;
        
        if (editingSubjectId) {
            result = await firebaseService.updateSubject(editingSubjectId, code, name, schedule, room, units);
            if (result.success) {
                alert('Subject updated successfully!');
            }
        } else {
            result = await firebaseService.addSubject(code, name, schedule, room, units);
            if (result.success) {
                alert('Subject added successfully!');
            }
        }

        if (result.success) {
            await loadSubjects();
            closeSubjectModal();
        } else {
            alert(result.message || 'Failed to save subject');
        }
    } catch (error) {
        console.error('Error saving subject:', error);
        alert('Failed to save subject: ' + error.message);
    }
}

async function deleteSubject(subjectId) {
    if (!confirm('Delete this subject? This action cannot be undone.')) return;

    try {
        const result = await firebaseService.deleteSubject(subjectId);
        
        if (result.success) {
            await loadSubjects();
            alert('Subject deleted successfully');
        } else {
            alert(result.message || 'Failed to delete subject');
        }
    } catch (error) {
        console.error('Error deleting subject:', error);
        alert('Failed to delete subject');
    }
}

// ==================== STUDENT MANAGEMENT ====================
async function loadStudents() {
    try {
        students = await firebaseService.getStudents();
        const accounts = await firebaseService.getStudentAccounts();
        const attendance = await getAllAttendanceRecords();
        renderStudentsTable(students, accounts, attendance);
    } catch (error) {
        console.error('Error loading students:', error);
    }
}

async function getAllAttendanceRecords() {
    try {
        const teacherId = firebaseService.currentTeacher?.id;
        if (!teacherId) return [];
        
        const snapshot = await database.ref(`teacher_data/${teacherId}/attendance`).once('value');
        const records = [];
        snapshot.forEach(dateSnapshot => {
            dateSnapshot.forEach(studentSnapshot => {
                studentSnapshot.forEach(subjectSnapshot => {
                    records.push({
                        studentId: studentSnapshot.key,
                        subjectCode: subjectSnapshot.key,
                        ...subjectSnapshot.val()
                    });
                });
            });
        });
        return records;
    } catch (error) {
        return [];
    }
}

function renderStudentsTable(students, accounts, attendance) {
    const tbody = document.getElementById('studentsBody');
    
    if (!students.length) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 30px;">No students found. Click "ADD STUDENT" to create one.</td></tr>';
        return;
    }
    
    let html = '';
    students.forEach(student => {
        const account = accounts.find(a => a.studentId === student.id);
        
        const studentRecords = attendance.filter(a => a.studentId === student.id);
        const totalSessions = studentRecords.length;
        const presentSessions = studentRecords.filter(a => a.status === 'present').length;
        const rate = totalSessions > 0 ? Math.round((presentSessions / totalSessions) * 100) : 0;
        
        let studentIdNumber = student.studentIdNumber;
        if (!studentIdNumber || studentIdNumber.includes('NaN')) {
            const year = new Date().getFullYear().toString().slice(-2);
            const randomNum = 200000 + Math.floor(Math.random() * 999);
            studentIdNumber = `${year}-${randomNum}`;
        }
        
        const yearLevel = student.yearLevel || 1;
        const section = student.section || 'A';
        const yearSection = `${yearLevel}${section}`;
        
        const subjectsCount = student.subjects?.length || 0;
        
        let rateColor = '#EF4444';
        if (rate >= 90) rateColor = '#10B981';
        else if (rate >= 75) rateColor = '#F59E0B';
        
        html += `
            <tr>
                <td><strong>${studentIdNumber}</strong></td>
                <td>${student.name}</td>
                <td>${account ? account.username : 'N/A'}</td>
                <td>${yearSection}</td>
                <td>${subjectsCount} subjects</td>
                <td><span style="color: ${rateColor}; font-weight: bold;">${rate}%</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn edit" onclick="editStudent('${student.id}')">✏️</button>
                        <button class="action-btn delete" onclick="deleteStudent('${student.id}')">🗑️</button>
                        <button class="action-btn" style="background: #8B5CF6;" onclick="pushStudentNotification('${student.id}', '${student.name}')">📢</button>
                    </div>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

async function pushStudentNotification(studentId, studentName) {
    const message = prompt(`Send notification to ${studentName}:`, "Please see me after class");
    if (!message) return;
    
    try {
        const result = await firebaseService.pushPersonalNotification(studentId, studentName, message);
        
        if (result.success) {
            alert(`Notification sent to ${studentName}!`);
        } else {
            alert('Failed to send notification');
        }
    } catch (error) {
        console.error('Error sending notification:', error);
        alert('Failed to send notification');
    }
}

function showAddStudent() {
    if (!subjects.length) {
        alert('Please add subjects first before creating students.');
        showTab('subjects');
        return;
    }
    
    editingStudentId = null;
    document.getElementById('studentModalTitle').textContent = 'ADD NEW STUDENT';
    document.getElementById('saveStudentBtn').textContent = 'CREATE STUDENT';
    document.getElementById('studentName').value = '';
    document.getElementById('studentUsername').value = '';
    document.getElementById('studentPassword').value = 'student123';
    document.getElementById('studentYear').value = '1';
    document.getElementById('studentSection').value = '';
    
    document.querySelectorAll('#subjectCheckboxes input').forEach(cb => {
        cb.checked = true;
    });
    
    document.getElementById('studentModal').classList.add('show');
}

async function editStudent(studentId) {
    try {
        const student = students.find(s => s.id === studentId);
        const accounts = await firebaseService.getStudentAccounts();
        const account = accounts.find(a => a.studentId === studentId);
        
        if (student) {
            editingStudentId = studentId;
            document.getElementById('studentModalTitle').textContent = 'EDIT STUDENT';
            document.getElementById('saveStudentBtn').textContent = 'UPDATE STUDENT';
            
            document.getElementById('studentName').value = student.name || '';
            document.getElementById('studentUsername').value = account?.username || '';
            document.getElementById('studentPassword').value = account?.password || 'student123';
            document.getElementById('studentYear').value = student.yearLevel || 1;
            document.getElementById('studentSection').value = student.section || '';
            
            document.querySelectorAll('#subjectCheckboxes input').forEach(cb => {
                cb.checked = student.subjects?.some(s => s.subjectCode === cb.value) || false;
            });
            
            document.getElementById('studentModal').classList.add('show');
        }
    } catch (error) {
        console.error('Error loading student:', error);
        alert('Failed to load student');
    }
}

function closeModal() {
    document.getElementById('studentModal').classList.remove('show');
    editingStudentId = null;
}

// ==================== FIXED: ADD STUDENT FUNCTION ====================
async function addStudent() {
    const name = document.getElementById('studentName').value.trim().toUpperCase();
    const username = document.getElementById('studentUsername').value.trim().toLowerCase();
    const password = document.getElementById('studentPassword').value;
    const yearLevel = parseInt(document.getElementById('studentYear').value);
    const section = document.getElementById('studentSection').value.trim().toUpperCase();

    const selectedSubjects = [];
    document.querySelectorAll('#subjectCheckboxes input:checked').forEach(cb => {
        selectedSubjects.push(cb.value);
    });

    if (!name || !username) {
        alert('Please enter name and username');
        return;
    }

    if (!password || password.length < 4) {
        alert('Password must be at least 4 characters');
        return;
    }

    if (selectedSubjects.length === 0) {
        alert('Please select at least one subject');
        return;
    }

    try {
        let result;
        
        if (editingStudentId) {
            result = await firebaseService.updateStudent(
                editingStudentId, name, username, password, yearLevel, section, selectedSubjects
            );
            
            if (result.success) {
                alert('Student updated successfully!');
            }
        } else {
            result = await firebaseService.addStudent(
                name, username, password, yearLevel, section, selectedSubjects
            );
            
            if (result.success) {
                alert(`Student created successfully! Username: ${username}, Password: ${password}`);
            }
        }

        if (result.success) {
            closeModal();
            await loadStudents();
            
            if (!editingStudentId) {
                showNotification(`Student created! Login: ${username} / ${password}`, 'success');
            }
        } else {
            alert(result.message || 'Failed to save student');
        }
    } catch (error) {
        console.error('Error saving student:', error);
        alert('Failed to save student: ' + error.message);
    }
}

async function deleteStudent(studentId) {
    if (!confirm('Delete this student? This action cannot be undone.')) return;

    try {
        const result = await firebaseService.deleteStudent(studentId);
        
        if (result.success) {
            await loadStudents();
            alert('Student deleted successfully');
        } else {
            alert(result.message || 'Failed to delete student');
        }
    } catch (error) {
        console.error('Error deleting student:', error);
        alert('Failed to delete student');
    }
}

// ==================== ATTENDANCE MANAGEMENT ====================
async function loadAttendance() {
    const date = document.getElementById('attendanceDate').value;
    const selectedSubject = document.getElementById('attendanceSubject').value;

    if (!selectedSubject) {
        document.getElementById('selectedSubjectCard').style.display = 'none';
        document.getElementById('quickActionsCard').style.display = 'none';
        document.getElementById('attendanceBody').innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 30px;">Please select a subject</td></tr>';
        document.getElementById('presentCount').textContent = '0';
        document.getElementById('absentCount').textContent = '0';
        document.getElementById('lateCount').textContent = '0';
        document.getElementById('totalStudents').textContent = '0';
        return;
    }

    try {
        const studentsList = students.filter(s => s.subjects?.some(sub => sub.subjectCode === selectedSubject));
        const attendance = await firebaseService.getAttendance(date);

        let present = 0, absent = 0, late = 0;
        let visibleStudents = [];

        if (selectedSubject) {
            visibleStudents = studentsList;
            
            visibleStudents.forEach(student => {
                const record = attendance[student.id]?.[selectedSubject] || { status: 'present' };
                if (record.status === 'present') present++;
                else if (record.status === 'absent') absent++;
                else if (record.status === 'late') late++;
            });

            const subject = subjects.find(s => s.code === selectedSubject);
            document.getElementById('selectedSubjectName').textContent = `${subject?.code} - ${subject?.name}`;
            document.getElementById('selectedSubjectDetails').textContent = `${subject?.schedule || 'TBA'} • ${subject?.room || 'TBA'}`;
            document.getElementById('subjectStudentCount').textContent = `${visibleStudents.length} students`;
            document.getElementById('selectedSubjectCard').style.display = 'block';
            document.getElementById('quickActionsCard').style.display = 'block';
            document.getElementById('quickActionSubject').textContent = selectedSubject;
        } else {
            visibleStudents = studentsList;
            document.getElementById('selectedSubjectCard').style.display = 'none';
            document.getElementById('quickActionsCard').style.display = 'none';
        }

        document.getElementById('presentCount').textContent = present;
        document.getElementById('absentCount').textContent = absent;
        document.getElementById('lateCount').textContent = late;
        document.getElementById('totalStudents').textContent = visibleStudents.length;

        renderAttendanceTable(visibleStudents, attendance, date, selectedSubject);
    } catch (error) {
        console.error('Error loading attendance:', error);
    }
}

function renderAttendanceTable(students, attendance, date, selectedSubject) {
    const tbody = document.getElementById('attendanceBody');
    
    if (!students.length) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 30px;">No students enrolled in this subject</td></tr>';
        return;
    }

    let html = '';
    students.forEach(student => {
        let studentIdNumber = student.studentIdNumber;
        if (!studentIdNumber || studentIdNumber.includes('NaN')) {
            const year = new Date().getFullYear().toString().slice(-2);
            const randomNum = 200000 + Math.floor(Math.random() * 999);
            studentIdNumber = `${year}-${randomNum}`;
        }

        const record = attendance[student.id]?.[selectedSubject] || { status: 'present', time: '--:--' };
        const badgeClass = record.status === 'present' ? 'badge-present' :
                          record.status === 'absent' ? 'badge-absent' : 'badge-late';
        
        html += `
            <tr>
                <td><strong>${studentIdNumber}</strong></td>
                <td>${student.name}</td>
                <td><span class="badge ${badgeClass}">${record.status.toUpperCase()}</span></td>
                <td>${record.time || '--:--'}</td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn present" onclick="updateAttendance('${student.id}', '${student.name}', '${selectedSubject}', 'present')">✅</button>
                        <button class="action-btn absent" onclick="updateAttendance('${student.id}', '${student.name}', '${selectedSubject}', 'absent')">❌</button>
                        <button class="action-btn late" onclick="updateAttendance('${student.id}', '${student.name}', '${selectedSubject}', 'late')">⏰</button>
                    </div>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

async function updateAttendance(studentId, studentName, subjectCode, status) {
    const date = document.getElementById('attendanceDate').value;

    try {
        const result = await firebaseService.updateAttendance(studentId, studentName, date, subjectCode, status);
        
        if (result.success) {
            await loadAttendance();
            const statusMsg = status.charAt(0).toUpperCase() + status.slice(1);
            showNotification(`${studentName} marked as ${statusMsg}`, 'success');
        } else {
            alert('Failed to update attendance');
        }
    } catch (error) {
        console.error('Error updating attendance:', error);
        alert('Failed to update attendance');
    }
}

// ==================== MARK ALL STUDENTS FUNCTION ====================
async function markAllStudents(status) {
    const date = document.getElementById('attendanceDate').value;
    const subjectCode = document.getElementById('attendanceSubject').value;
    
    if (!subjectCode) {
        alert('Please select a subject first');
        return;
    }

    const studentsList = students.filter(s => s.subjects?.some(sub => sub.subjectCode === subjectCode));
    
    if (studentsList.length === 0) {
        alert('No students enrolled in this subject');
        return;
    }

    if (!confirm(`Mark all ${studentsList.length} students as ${status.toUpperCase()}?`)) return;

    try {
        const result = await firebaseService.markAllStudents(date, subjectCode, studentsList, status);
        
        if (result.success) {
            await loadAttendance();
            showNotification(`All ${result.count} students marked as ${status}`, 'success');
        } else {
            alert('Failed to mark all students: ' + result.message);
        }
    } catch (error) {
        console.error('Error marking all students:', error);
        alert('Failed to mark all students: ' + error.message);
    }
}

// ==================== STUDENT FILTERS ====================
function filterStudentsBySubject() {
    const subjectFilter = document.getElementById('studentSubjectFilter').value;
    const searchTerm = document.getElementById('studentSearch').value.toLowerCase();
    
    const filteredStudents = students.filter(student => {
        const matchesSubject = !subjectFilter || student.subjects?.some(sub => sub.subjectCode === subjectFilter);
        const matchesSearch = !searchTerm || 
            student.name.toLowerCase().includes(searchTerm) || 
            (student.studentIdNumber && student.studentIdNumber.includes(searchTerm));
        return matchesSubject && matchesSearch;
    });
    
    renderFilteredStudents(filteredStudents);
}

async function renderFilteredStudents(filteredStudents) {
    const accounts = await firebaseService.getStudentAccounts();
    const attendance = await getAllAttendanceRecords();
    renderStudentsTable(filteredStudents, accounts, attendance);
}

function clearStudentFilters() {
    document.getElementById('studentSubjectFilter').value = '';
    document.getElementById('studentSearch').value = '';
    loadStudents();
}

// ==================== REPORTS ====================
function toggleReportDates() {
    const type = document.getElementById('reportType').value;
    document.getElementById('singleDateContainer').style.display = type === 'range' ? 'none' : 'block';
    document.getElementById('dateRangeContainer').style.display = type === 'range' ? 'block' : 'none';
}

async function generateReport() {
    const type = document.getElementById('reportType').value;
    const subject = document.getElementById('reportSubject').value;
    
    let reportData = [];

    if (type === 'daily') {
        const date = document.getElementById('reportDate').value;
        if (!date) return alert('Please select a date');
        reportData = await getReportData(date, date, subject);
    } else if (type === 'weekly') {
        const date = document.getElementById('reportDate').value;
        if (!date) return alert('Please select a date');
        const start = new Date(date);
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        reportData = await getReportData(
            start.toISOString().split('T')[0],
            end.toISOString().split('T')[0],
            subject
        );
    } else if (type === 'monthly') {
        const date = document.getElementById('reportDate').value;
        if (!date) return alert('Please select a date');
        const d = new Date(date);
        const firstDay = new Date(d.getFullYear(), d.getMonth(), 1);
        const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        reportData = await getReportData(
            firstDay.toISOString().split('T')[0],
            lastDay.toISOString().split('T')[0],
            subject
        );
    } else if (type === 'range') {
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        if (!startDate || !endDate) return alert('Please select dates');
        if (startDate > endDate) return alert('Start date must be before end date');
        reportData = await getReportData(startDate, endDate, subject);
    }

    renderReport(reportData);
    updateReportStats(reportData);
}

async function getReportData(startDate, endDate, subjectFilter = '') {
    return await firebaseService.generateReport(startDate, endDate, subjectFilter);
}

function renderReport(reportData) {
    const tbody = document.getElementById('reportBody');
    
    if (!reportData.length) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 30px;">No data for selected period</td></tr>';
        return;
    }

    let html = '';
    reportData.forEach(day => {
        const total = day.present + day.absent + day.late;
        const rate = total > 0 ? Math.round((day.present / total) * 100) : 0;
        
        let rateColor = '#EF4444';
        if (rate >= 90) rateColor = '#10B981';
        else if (rate >= 75) rateColor = '#F59E0B';

        html += `
            <tr>
                <td>${new Date(day.date).toLocaleDateString()}</td>
                <td>${day.subject}</td>
                <td style="color: #10B981; font-weight: bold;">${day.present}</td>
                <td style="color: #EF4444; font-weight: bold;">${day.absent}</td>
                <td style="color: #F59E0B; font-weight: bold;">${day.late}</td>
                <td>${total}</td>
                <td><span style="color: ${rateColor}; font-weight: bold;">${rate}%</span></td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

function updateReportStats(reportData) {
    if (!reportData.length) {
        document.getElementById('reportStats').innerHTML = `
            <div class="stat-card">
                <div class="stat-value">0</div>
                <div class="stat-label">TOTAL DAYS</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">0%</div>
                <div class="stat-label">AVG RATE</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">0</div>
                <div class="stat-label">TOTAL PRESENT</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${students.length}</div>
                <div class="stat-label">TOTAL STUDENTS</div>
            </div>
        `;
        return;
    }

    const totalDays = reportData.length;
    const totalPresent = reportData.reduce((sum, day) => sum + day.present, 0);
    const totalSessions = reportData.reduce((sum, day) => sum + day.total, 0);
    const avgRate = totalSessions > 0 ? Math.round((totalPresent / totalSessions) * 100) : 0;

    document.getElementById('reportStats').innerHTML = `
        <div class="stat-card">
            <div class="stat-value">${totalDays}</div>
            <div class="stat-label">TOTAL DAYS</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${avgRate}%</div>
            <div class="stat-label">AVG RATE</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${totalPresent}</div>
            <div class="stat-label">TOTAL PRESENT</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${students.length}</div>
            <div class="stat-label">TOTAL STUDENTS</div>
        </div>
    `;
}

function exportReport() {
    const rows = [];
    document.querySelectorAll('#reportBody tr').forEach(row => {
        const cols = row.querySelectorAll('td');
        if (cols.length) {
            rows.push([
                cols[0].textContent,
                cols[1].textContent,
                cols[2].textContent,
                cols[3].textContent,
                cols[4].textContent,
                cols[5].textContent,
                cols[6].textContent.replace('%', '')
            ]);
        }
    });
    
    if (!rows.length) {
        alert('No data to export');
        return;
    }
    
    const csv = [
        ['Date', 'Subject', 'Present', 'Absent', 'Late', 'Total', 'Rate (%)'],
        ...rows
    ].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
}

// ==================== CHECK AUTH ====================
function checkAuth() {
    const savedTeacher = localStorage.getItem('current_teacher');
    if (savedTeacher) {
        try {
            currentTeacher = JSON.parse(savedTeacher);
            firebaseService.currentTeacher = currentTeacher;
            document.getElementById('teacherName').textContent = currentTeacher.name;
            document.getElementById('loginSection').style.display = 'none';
            document.getElementById('dashboardSection').style.display = 'block';
            
            loadStudents();
            loadSubjects();
            loadAttendance();
            
            setupRealtimeListeners();
        } catch (error) {
            console.error('Error restoring session:', error);
            logout();
        }
    }
}
