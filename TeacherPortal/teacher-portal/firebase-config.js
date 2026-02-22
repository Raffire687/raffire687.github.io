// firebase-config.js
const firebaseConfig = {
    apiKey: "YOUR_API_KEY", // Add your Firebase API key
    authDomain: "YOUR_AUTH_DOMAIN", // Add your auth domain
    databaseURL: "https://mobileposfinal-8e080-default-rtdb.firebaseio.com/",
    projectId: "mobileposfinal-8e080",
    storageBucket: "YOUR_STORAGE_BUCKET", // Add your storage bucket
    messagingSenderId: "YOUR_SENDER_ID", // Add your sender ID
    appId: "YOUR_APP_ID" // Add your app ID
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
    async addStudent(name, username, password) {
        try {
            // Check if username exists
            const accountsSnapshot = await this.db.ref('student_accounts').orderByChild('username').equalTo(username).once('value');
            if (accountsSnapshot.exists()) {
                return { success: false, message: 'Username already exists' };
            }

            // Create student
            const studentRef = await this.db.ref('students').push({
                name: name.toUpperCase(),
                dateAdded: new Date().toISOString()
            });

            // Create student account
            await this.db.ref('student_accounts').child(studentRef.key).set({
                username: username.toLowerCase(),
                password: password,
                name: name.toUpperCase()
            });

            return { success: true, id: studentRef.key };
        } catch (error) {
            console.error('Error adding student:', error);
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

    // Update attendance
    async updateAttendance(studentId, studentName, date, status) {
        try {
            const time = status !== 'absent' 
                ? new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                : null;

            const timestamp = firebase.database.ServerValue.TIMESTAMP;

            // Update attendance record
            await this.db.ref(`attendance/${date}/${studentId}`).set({
                status: status,
                time: time,
                timestamp: timestamp,
                studentName: studentName
            });

            // Create notification for student (only for absent/late)
            if (status === 'absent' || status === 'late') {
                const notificationRef = this.db.ref(`notifications/${studentId}`).push();
                await notificationRef.set({
                    title: status === 'absent' ? '⚠️ Absence Alert' : '⏰ Late Arrival',
                    message: `You were marked ${status} on ${new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
                    type: status,
                    timestamp: timestamp,
                    isRead: false,
                    date: date,
                    icon: status === 'absent' ? '⚠️' : '⏰'
                });
            }

            return { success: true };
        } catch (error) {
            console.error('Error updating attendance:', error);
            return { success: false, message: error.message };
        }
    }

    // Listen to attendance changes
    listenToAttendance(date, callback) {
        const listener = this.db.ref(`attendance/${date}`).on('value', (snapshot) => {
            const attendance = {};
            snapshot.forEach(child => {
                attendance[child.key] = child.val();
            });
            callback(attendance);
        });

        return listener;
    }

    // Generate report
    async generateReport(startDate, endDate) {
        try {
            const report = [];
            const start = new Date(startDate);
            const end = new Date(endDate);
            
            const students = await this.getStudents();
            const totalStudents = students.length;

            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                const dateStr = d.toISOString().split('T')[0];
                const attendance = await this.getAttendance(dateStr);
                
                let present = 0, absent = 0, late = 0;
                
                Object.values(attendance).forEach(record => {
                    if (record.status === 'present') present++;
                    else if (record.status === 'absent') absent++;
                    else if (record.status === 'late') late++;
                });

                report.push({
                    date: dateStr,
                    present: present,
                    absent: absent,
                    late: late,
                    total: totalStudents
                });
            }

            return report;
        } catch (error) {
            console.error('Error generating report:', error);
            return [];
        }
    }

    // Clear all notifications for a student
    async clearAllNotifications(studentId) {
        try {
            await this.db.ref(`notifications/${studentId}`).remove();
            return { success: true };
        } catch (error) {
            console.error('Error clearing notifications:', error);
            return { success: false };
        }
    }
}

// Create global instance
const firebaseService = new FirebaseService();