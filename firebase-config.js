// firebase-config.js
const firebaseConfig = {
    apiKey: "AIzaSyCjk2uYHEsPnIT7sk-hIxKnNar-BaepHac",
    authDomain: "mobileposfinal-8e080.firebaseapp.com",
    databaseURL: "https://mobileposfinal-8e080-default-rtdb.firebaseio.com",
    projectId: "mobileposfinal-8e080",
    storageBucket: "mobileposfinal-8e080.appspot.com",
    messagingSenderId: "1075468764824",
    appId: "1:1075468764824:web:9c8a7b5f3d2e1a0b5c6d7e"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Firebase Service Class
class FirebaseService {
    constructor() {
        this.db = database;
        this.currentTeacher = null;
        this.attendanceListeners = {};
    }

    // Teacher Authentication
    async loginTeacher(email, password) {
        try {
            const snapshot = await this.db.ref('teachers').orderByChild('email').equalTo(email).once('value');
            const teachers = snapshot.val();
            
            if (teachers) {
                const teacherId = Object.keys(teachers)[0];
                const teacher = teachers[teacherId];
                
                if (teacher.password === password) {
                    this.currentTeacher = { id: teacherId, ...teacher };
                    return this.currentTeacher;
                }
            }
            return null;
        } catch (error) {
            console.error('Login error:', error);
            return null;
        }
    }

    // Register new teacher
    async registerTeacher(name, email, password) {
        try {
            // Check if teacher already exists
            const snapshot = await this.db.ref('teachers').orderByChild('email').equalTo(email).once('value');
            if (snapshot.exists()) {
                return { success: false, message: 'Email already registered' };
            }

            // Create new teacher
            const newTeacherRef = this.db.ref('teachers').push();
            await newTeacherRef.set({
                name: name,
                email: email,
                password: password,
                createdAt: firebase.database.ServerValue.TIMESTAMP
            });

            return { success: true, id: newTeacherRef.key };
        } catch (error) {
            console.error('Registration error:', error);
            return { success: false, message: error.message };
        }
    }

    // Get all students
    async getStudents() {
        try {
            const snapshot = await this.db.ref('students').once('value');
            const students = [];
            snapshot.forEach(child => {
                students.push({
                    id: child.key,
                    ...child.val()
                });
            });
            return students;
        } catch (error) {
            console.error('Error getting students:', error);
            return [];
        }
    }

    // Get student accounts for login credentials
    async getStudentAccounts() {
        try {
            const snapshot = await this.db.ref('student_accounts').once('value');
            const accounts = [];
            snapshot.forEach(child => {
                accounts.push({
                    studentId: child.key,
                    ...child.val()
                });
            });
            return accounts;
        } catch (error) {
            console.error('Error getting student accounts:', error);
            return [];
        }
    }

    // Add new student
    async addStudent(name, username, password, yearLevel, section, subjects) {
        try {
            // Check if username exists
            const accountsSnapshot = await this.db.ref('student_accounts').orderByChild('username').equalTo(username).once('value');
            if (accountsSnapshot.exists()) {
                return { success: false, message: 'Username already exists' };
            }

            // Generate student ID number
            const studentsSnapshot = await this.db.ref('students').once('value');
            const studentCount = studentsSnapshot.numChildren() + 1;
            const year = new Date().getFullYear().toString().slice(-2);
            const studentIdNumber = `${year}-${200000 + studentCount}`;

            // Create student
            const studentRef = await this.db.ref('students').push({
                name: name.toUpperCase(),
                studentIdNumber: studentIdNumber,
                yearLevel: yearLevel,
                section: section,
                subjects: subjects.map(code => ({ subjectCode: code })),
                dateAdded: new Date().toISOString()
            });

            // Create student account
            await this.db.ref('student_accounts').child(studentRef.key).set({
                username: username.toLowerCase(),
                password: password,
                name: name.toUpperCase()
            });

            // Send welcome notification
            await this.db.ref(`notifications/${studentRef.key}`).push({
                title: '🎉 Welcome!',
                message: `Your account has been created. Student ID: ${studentIdNumber}`,
                type: 'welcome',
                icon: '🎉',
                isRead: false,
                timestamp: Date.now(),
                date: new Date().toISOString().split('T')[0]
            });

            return { success: true, id: studentRef.key, studentIdNumber: studentIdNumber };
        } catch (error) {
            console.error('Error adding student:', error);
            return { success: false, message: error.message };
        }
    }

    // Update student
    async updateStudent(studentId, name, username, password, yearLevel, section, subjects) {
        try {
            // Check if username exists for other students
            const accountsSnapshot = await this.db.ref('student_accounts').orderByChild('username').equalTo(username).once('value');
            if (accountsSnapshot.exists()) {
                const existingId = Object.keys(accountsSnapshot.val())[0];
                if (existingId !== studentId) {
                    return { success: false, message: 'Username already exists' };
                }
            }

            // Update student
            await this.db.ref('students').child(studentId).update({
                name: name.toUpperCase(),
                yearLevel: yearLevel,
                section: section,
                subjects: subjects.map(code => ({ subjectCode: code }))
            });

            // Update student account
            await this.db.ref('student_accounts').child(studentId).update({
                username: username.toLowerCase(),
                password: password,
                name: name.toUpperCase()
            });

            return { success: true };
        } catch (error) {
            console.error('Error updating student:', error);
            return { success: false, message: error.message };
        }
    }

    // Delete student
    async deleteStudent(studentId) {
        try {
            // Remove student
            await this.db.ref(`students/${studentId}`).remove();
            
            // Remove student account
            await this.db.ref(`student_accounts/${studentId}`).remove();
            
            // Remove all attendance records for this student
            const attendanceSnapshot = await this.db.ref('attendance').once('value');
            const updates = {};
            
            attendanceSnapshot.forEach(dateSnapshot => {
                const date = dateSnapshot.key;
                if (dateSnapshot.child(studentId).exists()) {
                    updates[`attendance/${date}/${studentId}`] = null;
                }
            });
            
            // Remove notifications
            await this.db.ref(`notifications/${studentId}`).remove();
            
            // Apply updates
            if (Object.keys(updates).length > 0) {
                await this.db.ref().update(updates);
            }
            
            return { success: true };
        } catch (error) {
            console.error('Error deleting student:', error);
            return { success: false, message: error.message };
        }
    }

    // Get all subjects
    async getSubjects() {
        try {
            const snapshot = await this.db.ref('subjects').once('value');
            const subjects = [];
            snapshot.forEach(child => {
                subjects.push({
                    id: child.key,
                    ...child.val()
                });
            });
            return subjects;
        } catch (error) {
            console.error('Error getting subjects:', error);
            return [];
        }
    }

    // Add subject
    async addSubject(code, name, schedule, room, units) {
        try {
            // Check if subject code exists
            const snapshot = await this.db.ref('subjects').orderByChild('code').equalTo(code).once('value');
            if (snapshot.exists()) {
                return { success: false, message: 'Subject code already exists' };
            }

            const subjectRef = await this.db.ref('subjects').push({
                code: code.toUpperCase(),
                name: name,
                schedule: schedule || 'TBA',
                room: room || 'TBA',
                units: units || 3,
                createdAt: Date.now()
            });

            return { success: true, id: subjectRef.key };
        } catch (error) {
            console.error('Error adding subject:', error);
            return { success: false, message: error.message };
        }
    }

    // Update subject
    async updateSubject(subjectId, code, name, schedule, room, units) {
        try {
            await this.db.ref('subjects').child(subjectId).update({
                code: code.toUpperCase(),
                name: name,
                schedule: schedule || 'TBA',
                room: room || 'TBA',
                units: units || 3
            });

            return { success: true };
        } catch (error) {
            console.error('Error updating subject:', error);
            return { success: false, message: error.message };
        }
    }

    // Delete subject
    async deleteSubject(subjectId) {
        try {
            await this.db.ref('subjects').child(subjectId).remove();
            return { success: true };
        } catch (error) {
            console.error('Error deleting subject:', error);
            return { success: false, message: error.message };
        }
    }

    // Get attendance for a specific date
    async getAttendance(date) {
        try {
            const snapshot = await this.db.ref(`attendance/${date}`).once('value');
            const attendance = {};
            snapshot.forEach(child => {
                attendance[child.key] = child.val();
            });
            return attendance;
        } catch (error) {
            console.error('Error getting attendance:', error);
            return {};
        }
    }

    // Get attendance for a student
    async getStudentAttendance(studentId, startDate, endDate) {
        try {
            const attendance = [];
            const start = new Date(startDate);
            const end = new Date(endDate);
            
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                const dateStr = d.toISOString().split('T')[0];
                const snapshot = await this.db.ref(`attendance/${dateStr}/${studentId}`).once('value');
                const records = snapshot.val();
                
                if (records) {
                    Object.entries(records).forEach(([subjectCode, record]) => {
                        attendance.push({
                            studentId: studentId,
                            subjectCode: subjectCode,
                            date: dateStr,
                            status: record.status,
                            time: record.time,
                            timestamp: record.timestamp
                        });
                    });
                }
            }
            
            return attendance;
        } catch (error) {
            console.error('Error getting student attendance:', error);
            return [];
        }
    }

    // Update attendance
    async updateAttendance(studentId, studentName, date, subjectCode, status) {
        try {
            const time = status !== 'absent' 
                ? new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                : null;

            const timestamp = Date.now();

            // Update attendance record
            await this.db.ref(`attendance/${date}/${studentId}/${subjectCode}`).set({
                status: status,
                time: time,
                timestamp: timestamp,
                studentName: studentName,
                subjectCode: subjectCode
            });

            // Create notification for student (only for absent/late)
            if (status === 'absent' || status === 'late') {
                const notificationRef = this.db.ref(`notifications/${studentId}`).push();
                await notificationRef.set({
                    title: status === 'absent' ? '⚠️ Absence Alert' : '⏰ Late Arrival',
                    message: `You were marked ${status} in ${subjectCode} on ${new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
                    type: status,
                    subjectCode: subjectCode,
                    time: time,
                    timestamp: timestamp,
                    isRead: false,
                    icon: status === 'absent' ? '⚠️' : '⏰',
                    date: date
                });
            }

            return { success: true };
        } catch (error) {
            console.error('Error updating attendance:', error);
            return { success: false, message: error.message };
        }
    }

    // Mark all students - FIXED AND ENHANCED
    async markAllStudents(date, subjectCode, students, status) {
        try {
            const timestamp = Date.now();
            const time = status !== 'absent' 
                ? new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                : null;

            const updates = {};
            const notifications = {};

            students.forEach(student => {
                // Update attendance
                updates[`attendance/${date}/${student.id}/${subjectCode}`] = {
                    status: status,
                    time: time,
                    timestamp: timestamp,
                    studentName: student.name,
                    subjectCode: subjectCode
                };

                // Create notifications for absent/late
                if (status === 'absent' || status === 'late') {
                    const notificationId = this.db.ref(`notifications/${student.id}`).push().key;
                    notifications[`notifications/${student.id}/${notificationId}`] = {
                        title: status === 'absent' ? '⚠️ Absence Alert' : '⏰ Late Arrival',
                        message: `You were marked ${status} in ${subjectCode} on ${new Date(date).toLocaleDateString()}`,
                        type: status,
                        subjectCode: subjectCode,
                        time: time,
                        timestamp: timestamp,
                        isRead: false,
                        icon: status === 'absent' ? '⚠️' : '⏰',
                        date: date
                    };
                }
            });

            // Apply all updates
            if (Object.keys(updates).length > 0) {
                await this.db.ref().update({ ...updates, ...notifications });
            }
            
            return { success: true, count: students.length };
        } catch (error) {
            console.error('Error marking all students:', error);
            return { success: false, message: error.message };
        }
    }

    // Get notifications for a student
    async getNotifications(studentId) {
        try {
            const snapshot = await this.db.ref(`notifications/${studentId}`).once('value');
            const notifications = [];
            snapshot.forEach(child => {
                notifications.push({
                    id: child.key,
                    ...child.val()
                });
            });
            return notifications.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        } catch (error) {
            console.error('Error getting notifications:', error);
            return [];
        }
    }

    // Mark notification as read
    async markNotificationAsRead(studentId, notificationId) {
        try {
            await this.db.ref(`notifications/${studentId}/${notificationId}/isRead`).set(true);
            return { success: true };
        } catch (error) {
            console.error('Error marking notification as read:', error);
            return { success: false };
        }
    }

    // Mark all notifications as read
    async markAllNotificationsAsRead(studentId) {
        try {
            const snapshot = await this.db.ref(`notifications/${studentId}`).once('value');
            const updates = {};
            
            snapshot.forEach(child => {
                if (!child.val().isRead) {
                    updates[`notifications/${studentId}/${child.key}/isRead`] = true;
                }
            });
            
            if (Object.keys(updates).length > 0) {
                await this.db.ref().update(updates);
            }
            
            return { success: true };
        } catch (error) {
            console.error('Error marking all as read:', error);
            return { success: false };
        }
    }

    // Delete notification
    async deleteNotification(studentId, notificationId) {
        try {
            await this.db.ref(`notifications/${studentId}/${notificationId}`).remove();
            return { success: true };
        } catch (error) {
            console.error('Error deleting notification:', error);
            return { success: false };
        }
    }

    // Clear all notifications
    async clearAllNotifications(studentId) {
        try {
            await this.db.ref(`notifications/${studentId}`).remove();
            return { success: true };
        } catch (error) {
            console.error('Error clearing notifications:', error);
            return { success: false };
        }
    }

    // Push announcement to subject students
    async pushAnnouncement(subjectCode, subjectName, message, students) {
        try {
            const timestamp = Date.now();
            const date = new Date().toISOString().split('T')[0];
            const notifications = {};

            students.forEach(student => {
                if (student.subjects?.some(s => s.subjectCode === subjectCode)) {
                    const notificationId = this.db.ref(`notifications/${student.id}`).push().key;
                    notifications[`notifications/${student.id}/${notificationId}`] = {
                        title: `📢 ${subjectCode} Announcement`,
                        message: message,
                        type: 'announcement',
                        subjectCode: subjectCode,
                        subjectName: subjectName,
                        timestamp: timestamp,
                        isRead: false,
                        icon: '📢',
                        date: date
                    };
                }
            });

            await this.db.ref().update(notifications);
            return { success: true, count: Object.keys(notifications).length };
        } catch (error) {
            console.error('Error pushing announcement:', error);
            return { success: false };
        }
    }

    // Push personal notification to student
    async pushPersonalNotification(studentId, studentName, message) {
        try {
            const notificationRef = this.db.ref(`notifications/${studentId}`).push();
            await notificationRef.set({
                title: '📌 Personal Message',
                message: message,
                type: 'personal',
                timestamp: Date.now(),
                isRead: false,
                icon: '📌',
                date: new Date().toISOString().split('T')[0]
            });

            return { success: true };
        } catch (error) {
            console.error('Error pushing personal notification:', error);
            return { success: false };
        }
    }

    // Generate report
    async generateReport(startDate, endDate, subjectFilter = '') {
        try {
            const report = [];
            const start = new Date(startDate);
            const end = new Date(endDate);
            
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                const dateStr = d.toISOString().split('T')[0];
                const attendance = await this.getAttendance(dateStr);
                
                let present = 0, absent = 0, late = 0;

                Object.values(attendance).forEach(studentAttendance => {
                    Object.entries(studentAttendance).forEach(([subjectCode, record]) => {
                        if (!subjectFilter || subjectFilter === subjectCode) {
                            if (record.status === 'present') present++;
                            else if (record.status === 'absent') absent++;
                            else if (record.status === 'late') late++;
                        }
                    });
                });

                if (present > 0 || absent > 0 || late > 0) {
                    report.push({
                        date: dateStr,
                        subject: subjectFilter || 'All Subjects',
                        present: present,
                        absent: absent,
                        late: late,
                        total: present + absent + late
                    });
                }
            }

            return report;
        } catch (error) {
            console.error('Error generating report:', error);
            return [];
        }
    }
}

// Create global instance
const firebaseService = new FirebaseService();
