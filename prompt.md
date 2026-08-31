Booking Module = GR_Booking, 

when booking is create requited fields are listed below, 

booking_status_c = 'Reserved'
booking_date_time_c = datetime, it keeps the date from the booking
booking_start_time_c = datetime, it keeps the start of booking
booking_end_time_c = datetime, it keeps the end of the booking
send_booking_reminder_c = true
reminder_in_c = 8
booking_length_c= is the calculation between the start datetime and end datetime

* accounts_gr_booking_1_name
  Clients Accounts = Accounts
  Relationship

gr_pet_gr_booking_1_name
Clients Pets = GR_Pet
Relationship



