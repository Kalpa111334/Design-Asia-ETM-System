# Location-Based Tasks with OpenStreetMap Integration

This implementation provides a comprehensive location-based task management system with real-time OpenStreetMap integration, mobile-responsive design, and geofencing capabilities.

## Features Implemented

### ✅ Core Features
- **Real-time OpenStreetMap Integration**: Interactive maps using Leaflet and React-Leaflet
- **Geofence Management**: Create, edit, and manage geofences by clicking on the map
- **Location-Based Tasks**: Tasks that require employees to be at specific locations
- **Mobile Responsive**: Optimized for mobile devices with touch controls
- **Real-time Updates**: Live location tracking and map updates
- **Automatic Location Saving**: Geofences and locations are automatically saved

### ✅ User Experience
- **Interactive Map Creation**: Click anywhere on the map to create geofences
- **Real-time Zoom**: Maps zoom in automatically when locations are selected
- **Mobile-Friendly Controls**: Touch-optimized controls and responsive design
- **Location Selection**: Easy location picking with visual feedback
- **Centered Map Display**: Selected locations are automatically centered on the map

## Components Created

### 1. GeofenceManagerOSM (`/src/components/admin/GeofenceManagerOSM.tsx`)
- Interactive OpenStreetMap-based geofence manager
- Click-to-create geofence functionality
- Real-time location selection with visual feedback
- Mobile-responsive controls
- Automatic saving of geofences

### 2. MapLocationPickerOSM (`/src/components/admin/MapLocationPickerOSM.tsx`)
- Modal component for interactive location selection
- Search functionality using OpenStreetMap Nominatim
- Current location detection
- Mobile-optimized interface
- Address resolution for selected locations

### 3. TasksWithLocationMap (`/src/components/employee/TasksWithLocationMap.tsx`)
- Full-screen location-based task viewer
- Interactive map with task markers
- Real-time location tracking
- Check-in functionality for tasks
- Mobile-responsive layout with sidebar

### 4. Enhanced TaskForm (`/src/components/TaskForm.tsx`)
- Location-based task option checkbox
- Geofence selection from saved locations
- Custom location picker integration
- Validation for location requirements

## Services Created

### 1. LocationTaskService (`/src/services/LocationTaskService.ts`)
- Comprehensive location-based task management
- Automatic saving of task locations
- Distance calculations and proximity checking
- Integration with geofencing system

### 2. RealTimeLocationService (`/src/services/RealTimeLocationService.ts`)
- Real-time location tracking
- Geofence event detection
- Battery level monitoring
- Location permission handling

## Database Schema

The system includes the following tables:
- `geofences`: Store geofence definitions
- `task_locations`: Link tasks to specific locations
- `task_location_events`: Track location-based events
- `location_alerts`: Store location-based notifications
- `employee_movement_history`: Track employee movement

## Setup Instructions

### 1. Database Setup
Run the SQL script in your Supabase SQL Editor:
```sql
-- Execute the contents of LOCATION_BASED_TASKS_SETUP.sql
```

### 2. Dependencies
The following packages are already included in package.json:
- `leaflet`: OpenStreetMap library
- `react-leaflet`: React bindings for Leaflet
- `@types/leaflet`: TypeScript definitions

### 3. CSS Styles
Mobile-responsive styles are included in `/src/styles/leaflet-mobile.css` and automatically imported.

## Usage Guide

### For Administrators

#### Creating Geofences
1. Navigate to Location Management page
2. Click "Create Geofence" button
3. Interactive map opens with Sri Lanka centered
4. Click anywhere on the map to select location
5. Fill in geofence details (name, radius, description)
6. Click "Create Geofence" to save

#### Creating Location-Based Tasks
1. Go to Create Task page
2. Fill in basic task details
3. Check "Location-Based Task" option
4. Choose between:
   - **Saved Location**: Select from existing geofences
   - **Custom Location**: Pick location on interactive map
5. Complete task creation

### For Employees

#### Viewing Location Tasks
1. Go to Tasks page
2. Click "View Location Tasks" button
3. Interactive map shows all location-based tasks
4. Click on task markers to see details
5. Use "Check In" button when at location

#### Task Location Indicators
- Tasks with location requirements show a map icon
- "View on Map" button for individual tasks
- Real-time distance calculations

## Mobile Optimization

### Touch Controls
- Optimized touch targets for mobile devices
- Smooth pan and zoom gestures
- Touch-friendly control buttons

### Responsive Design
- Adaptive layouts for different screen sizes
- Mobile-first approach
- Optimized map sizes for mobile viewing

### Performance
- Efficient map rendering
- Minimal data usage
- Battery-optimized location tracking

## Real-Time Features

### Location Tracking
- Automatic location updates every 30 seconds
- Battery level monitoring
- Accuracy tracking

### Map Updates
- Real-time marker updates
- Live distance calculations
- Automatic map centering

### Notifications
- Geofence entry/exit alerts
- Task proximity notifications
- Location-based reminders

## Browser Compatibility

### Supported Features
- Geolocation API
- WebGL for map rendering
- Touch events
- Real-time subscriptions

### Fallbacks
- Graceful degradation for older browsers
- Manual location entry when GPS unavailable
- Offline map caching (future enhancement)

## Security Considerations

### Row Level Security (RLS)
- Users can only see their assigned tasks
- Admins can manage all geofences
- Location data is protected per user

### Privacy
- Location data is only stored when necessary
- Users control location sharing
- Automatic data cleanup policies

## Future Enhancements

### Planned Features
- Offline map support
- Advanced geofence shapes (polygons)
- Route optimization
- Historical location analytics
- Integration with external mapping services

### Performance Improvements
- Map tile caching
- Lazy loading of location data
- Background location sync

## Troubleshooting

### Common Issues

1. **Map not loading**
   - Check internet connection
   - Verify OpenStreetMap tile servers are accessible
   - Clear browser cache

2. **Location not working**
   - Enable location permissions in browser
   - Check HTTPS requirement for geolocation
   - Try manual location entry

3. **Tasks not showing on map**
   - Verify task has location data
   - Check database permissions
   - Refresh the page

### Browser Console Errors
- Enable developer tools to see detailed error messages
- Check network tab for failed requests
- Verify Supabase connection

## Support

For technical support or feature requests:
1. Check browser console for errors
2. Verify database setup is complete
3. Ensure all dependencies are installed
4. Test with different browsers/devices

## License

This implementation is part of the TaskVision task management system and follows the same licensing terms.